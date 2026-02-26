import * as z from "zod";

import type { ContactDossier } from "../../../types";
import { storeGet, storeSet } from "../../store";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { getUserLevel, setUserLevel, checkContactLimit, MAX_CONTACTS_LEVEL_1 } from "../utils/user-level";
import type { UserLevel } from "../utils/user-level";

const userDataKey = (phone: string) => `user:${phone}:data`;

const ContactRelationSchema = z.object({
  contactId: z.string().min(1),
  strength: z.preprocess(
    (v) => typeof v === 'number' ? Math.min(Math.max(Math.round(v), 0), 10) : 5,
    z.number().int().min(0).max(10)
  ),
  description: z.string().optional(),
});

const PowerGroupingSchema = z.object({
  groupName: z.string().min(1),
  suzerainId: z.string().optional(),
  vassalIds: z.array(z.string()).default([]),
});

const DiaryEntrySchema = z.object({
  id: z.string().min(1),
  date: z.coerce.date(),
  type: z.union([z.literal("auto"), z.literal("manual")]),
  content: z.string(),
  attachments: z.array(z.string()).optional(),
});

const ContactInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  phoneNumbers: z.array(z.string()),
  emails: z.array(z.string()),
  company: z.string().optional(),
  position: z.string().optional(),
  goal: z.string().optional(),
  notes: z.string().optional(),
  photo: z.string().optional(),
});

const ContactDossierSchema = z.object({
  contact: ContactInfoSchema,
  sectors: z.array(z.string()),
  functionalCircle: z.union([
    z.literal("support"),
    z.literal("productivity"),
    z.literal("development"),
  ]),
  importance: z.union([
    z.literal("critical"),
    z.literal("high"),
    z.literal("medium"),
    z.literal("low"),
  ]),
  relations: z.array(ContactRelationSchema),
  diary: z.array(DiaryEntrySchema),
  addedDate: z.coerce.date(),
  lastInteraction: z.coerce.date().optional(),
  powerGrouping: PowerGroupingSchema.optional(),
}) as z.ZodType<ContactDossier>;

const UserAppDataSchema = z.object({
  phoneNumber: z.string().min(1),
  dossiers: z.array(ContactDossierSchema),
  sectors: z.array(z.string()),
  powerGroupings: z.array(z.string()),
  updatedAt: z.number().int().nonnegative(),
});

type UserAppData = z.infer<typeof UserAppDataSchema>;

const emptyUserData = (phoneNumber: string): UserAppData => ({
  phoneNumber,
  dossiers: [],
  sectors: ["work", "business", "politics", "personal", "other"],
  powerGroupings: [],
  updatedAt: Date.now(),
});

export const appDataRouter = createTRPCRouter({
  getMyData: publicProcedure.query(async ({ ctx }) => {
    const phone = ctx.userPhone;

    console.log("[backend] appData.getMyData", { phone });

    if (!phone) {
      return { ok: false as const, error: "UNAUTHENTICATED" as const };
    }

    const key = userDataKey(phone);
    const stored = await storeGet<UserAppData>(key);

    if (!stored) {
      const initial = emptyUserData(phone);
      await storeSet(key, initial);
      return { ok: true as const, data: initial };
    }

    const parsed = UserAppDataSchema.safeParse(stored);
    if (!parsed.success) {
      console.log("[backend] appData.getMyData invalid stored data", {
        issues: parsed.error.issues,
      });
      const fallback = emptyUserData(phone);
      await storeSet(key, fallback);
      return { ok: true as const, data: fallback };
    }

    // Проверяем нужна ли нормализация (strength > 10 в старых данных)
    const hasOutOfRangeStrength = (stored as any)?.dossiers?.some((d: any) =>
      d?.relations?.some((r: any) => typeof r?.strength === 'number' && r.strength > 10)
    );
    if (hasOutOfRangeStrength) {
      console.log("[backend] appData.getMyData: normalizing strength values (>10 found), saving fixed data");
      await storeSet(key, { ...parsed.data, updatedAt: Date.now() });
    }

    return { ok: true as const, data: parsed.data };
  }),

  saveMyData: publicProcedure
    .input(
      z.object({
        dossiers: z.array(ContactDossierSchema),
        sectors: z.array(z.string()),
        powerGroupings: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const phone = ctx.userPhone;

      console.log("[backend] appData.saveMyData", {
        phone,
        dossiers: input.dossiers.length,
        sectors: input.sectors.length,
        powerGroupings: input.powerGroupings.length,
      });

      if (!phone) {
        return { ok: false as const, error: "UNAUTHENTICATED" as const };
      }

      // Проверяем лимит контактов для уровня 1
      const limitCheck = await checkContactLimit(phone, input.dossiers.length);
      let dossiers = input.dossiers;

      if (!limitCheck.allowed && limitCheck.maxCount) {
        console.log("[backend] appData.saveMyData: contact limit reached", {
          phone,
          level: limitCheck.level,
          count: input.dossiers.length,
          max: limitCheck.maxCount,
        });
        // Обрезаем до лимита (оставляем первые N)
        dossiers = input.dossiers.slice(0, limitCheck.maxCount);
      }

      const next: UserAppData = {
        phoneNumber: phone,
        dossiers,
        sectors: input.sectors,
        powerGroupings: input.powerGroupings,
        updatedAt: Date.now(),
      };

      const key = userDataKey(phone);
      await storeSet(key, next);

      return {
        ok: true as const,
        updatedAt: next.updatedAt,
        contactsLimited: !limitCheck.allowed,
        maxContacts: limitCheck.maxCount,
        level: limitCheck.level,
      };
    }),

  /**
   * Получить уровень пользователя и лимиты.
   */
  getMyLevel: publicProcedure.query(async ({ ctx }) => {
    const phone = ctx.userPhone;
    if (!phone) {
      return { ok: false as const, error: "UNAUTHENTICATED" as const };
    }

    const levelData = await getUserLevel(phone);
    const key = userDataKey(phone);
    const stored = await storeGet<UserAppData>(key);
    const currentCount = stored && Array.isArray(stored.dossiers) ? stored.dossiers.length : 0;

    return {
      ok: true as const,
      level: levelData.level,
      subscribedUntil: levelData.subscribedUntil,
      maxContacts: levelData.level >= 2 ? null : MAX_CONTACTS_LEVEL_1,
      currentContacts: currentCount,
      showAds: levelData.level < 2,
    };
  }),

  /**
   * Установить уровень (для админов или после оплаты).
   */
  setLevel: publicProcedure
    .input(z.object({
      phone: z.string().min(10),
      level: z.number().min(1).max(2),
      durationDays: z.number().min(1).max(365).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Только админ может менять уровень вручную
      if (!ctx.adminUser) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const subscribedUntil = input.level === 2
        ? Date.now() + (input.durationDays ?? 7) * 24 * 60 * 60 * 1000
        : undefined;

      const result = await setUserLevel(
        input.phone,
        input.level as UserLevel,
        subscribedUntil,
      );

      console.log("[backend] appData.setLevel", {
        admin: ctx.adminUser.username,
        phone: input.phone,
        level: input.level,
        subscribedUntil: result.subscribedUntil,
      });

      return { ok: true as const, levelData: result };
    }),
});
