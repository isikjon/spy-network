import * as z from "zod";

import type { ContactDossier } from "../../../types";
import { storeGet, storeSet } from "../../store";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { getUserLevel, setUserLevel, checkContactLimit, MAX_CONTACTS_LEVEL_1 } from "../utils/user-level";
import type { UserLevel } from "../utils/user-level";
import { getOrCreateUid } from "../utils/uid-manager";

const userDataKey = (uid: string) => `user_data:${uid}`;
const legacyUserDataKey = (phone: string) => `user:${phone}:data`;

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
  birthday: z.string().optional(),
  linkedUid: z.string().optional(),
});

const ContactAssessmentSchema = z.object({
  resourcePotential: z.number(),
  mutualInterests: z.number(),
  openness: z.number(),
  influence: z.number(),
  longTermPotential: z.number(),
  impressions: z.string(),
  valueIndex: z.number(),
  date: z.string(),
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
  nextAction: z.string().optional(),
  nextActionDate: z.string().optional(),
  assessment: ContactAssessmentSchema.optional(),
  trustLevel: z.number().optional(),
  noDirectConnection: z.boolean().optional(),
  relationshipLevel: z.union([
    z.literal("acquaintance"),
    z.literal("contact"),
    z.literal("useful_connection"),
    z.literal("trusted_person"),
    z.literal("ally"),
  ]).optional(),
}) as z.ZodType<ContactDossier>;

const GoalStepSchema = z.object({
  id: z.string().min(1),
  type: z.union([z.literal("meeting"), z.literal("call"), z.literal("write"), z.literal("event")]),
  content: z.string(),
  result: z.string(),
  contactIds: z.array(z.string()),
  order: z.number(),
  completed: z.boolean().optional(),
});

const StrategicGoalSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  deadline: z.string(),
  priority: z.number(),
  contactIds: z.array(z.string()),
  nextStep: z.string(),
  notes: z.string(),
  createdAt: z.string(),
  directionId: z.string().optional(),
  steps: z.array(GoalStepSchema).optional(),
});

const GoalDirectionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  order: z.number(),
});

const UserAppDataSchema = z.object({
  uid: z.string().min(1),
  dossiers: z.array(ContactDossierSchema),
  sectors: z.array(z.string()),
  powerGroupings: z.array(z.string()),
  goals: z.array(StrategicGoalSchema).optional(),
  goalDirections: z.array(GoalDirectionSchema).optional(),
  updatedAt: z.number().int().nonnegative(),
  phoneNumber: z.string().optional(),
});

type UserAppData = z.infer<typeof UserAppDataSchema>;

const DEFAULT_GOAL_DIRECTIONS = [
  { id: 'dir_business', name: 'Бизнес', order: 0 },
  { id: 'dir_health', name: 'Здоровье', order: 1 },
  { id: 'dir_travel', name: 'Путешествие', order: 2 },
  { id: 'dir_project_rg', name: 'Проект РГ', order: 3 },
];

const emptyUserData = (uid: string): UserAppData => ({
  uid,
  dossiers: [],
  sectors: ["work", "business", "politics", "personal", "other"],
  powerGroupings: [],
  goals: [],
  goalDirections: DEFAULT_GOAL_DIRECTIONS,
  updatedAt: Date.now(),
});

async function migrateFromPhoneKey(phone: string, uid: string): Promise<UserAppData | null> {
  const legacyKey = legacyUserDataKey(phone);
  const legacy = await storeGet<any>(legacyKey);
  if (!legacy) return null;

  console.log("[backend] appData: migrating data from phone key to uid key", { phone, uid });
  const migrated: UserAppData = {
    uid,
    dossiers: legacy.dossiers ?? [],
    sectors: legacy.sectors ?? ["work", "business", "politics", "personal", "other"],
    powerGroupings: legacy.powerGroupings ?? [],
    goals: legacy.goals ?? [],
    goalDirections: legacy.goalDirections ?? DEFAULT_GOAL_DIRECTIONS,
    updatedAt: legacy.updatedAt ?? Date.now(),
    phoneNumber: phone,
  };

  await storeSet(userDataKey(uid), migrated);
  console.log("[backend] appData: migration complete", { uid, dossiers: migrated.dossiers.length });
  return migrated;
}

export const appDataRouter = createTRPCRouter({
  getMyData: publicProcedure.query(async ({ ctx }) => {
    const phone = ctx.userPhone;
    const uid = ctx.userUid;

    console.log("[backend] appData.getMyData", { phone, uid });

    if (!phone || !uid) {
      return { ok: false as const, error: "UNAUTHENTICATED" as const };
    }

    const key = userDataKey(uid);
    let stored = await storeGet<UserAppData>(key);

    if (!stored) {
      stored = await migrateFromPhoneKey(phone, uid);
    }

    if (!stored) {
      const initial = emptyUserData(uid);
      await storeSet(key, initial);
      return { ok: true as const, data: { ...initial, uid } };
    }

    const parsed = UserAppDataSchema.safeParse(stored);
    if (!parsed.success) {
      console.log("[backend] appData.getMyData invalid stored data", {
        issues: parsed.error.issues,
      });
      const fallback = emptyUserData(uid);
      await storeSet(key, fallback);
      return { ok: true as const, data: { ...fallback, uid } };
    }

    const hasOutOfRangeStrength = (stored as any)?.dossiers?.some((d: any) =>
      d?.relations?.some((r: any) => typeof r?.strength === 'number' && r.strength > 10)
    );
    if (hasOutOfRangeStrength) {
      console.log("[backend] appData.getMyData: normalizing strength values (>10 found), saving fixed data");
      await storeSet(key, { ...parsed.data, updatedAt: Date.now() });
    }

    const dataWithGoals = {
      ...parsed.data,
      uid,
      goals: (stored as any)?.goals ?? parsed.data.goals ?? [],
      goalDirections: (stored as any)?.goalDirections ?? parsed.data.goalDirections ?? DEFAULT_GOAL_DIRECTIONS,
    };
    return { ok: true as const, data: dataWithGoals };
  }),

  saveMyData: publicProcedure
    .input(
      z.object({
        dossiers: z.array(ContactDossierSchema),
        sectors: z.array(z.string()),
        powerGroupings: z.array(z.string()),
        goals: z.array(StrategicGoalSchema).optional(),
        goalDirections: z.array(GoalDirectionSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const phone = ctx.userPhone;
      const uid = ctx.userUid;

      console.log("[backend] appData.saveMyData", {
        phone,
        uid,
        dossiers: input.dossiers.length,
        sectors: input.sectors.length,
        powerGroupings: input.powerGroupings.length,
        goals: input.goals?.length ?? 'unchanged',
        goalDirections: input.goalDirections?.length ?? 'unchanged',
      });

      if (!phone || !uid) {
        return { ok: false as const, error: "UNAUTHENTICATED" as const };
      }

      const limitCheck = await checkContactLimit(uid, input.dossiers.length);
      let dossiers = input.dossiers;

      if (!limitCheck.allowed && limitCheck.maxCount) {
        console.log("[backend] appData.saveMyData: contact limit reached", {
          uid,
          level: limitCheck.level,
          count: input.dossiers.length,
          max: limitCheck.maxCount,
        });
        dossiers = input.dossiers.slice(0, limitCheck.maxCount);
      }

      const key = userDataKey(uid);
      const existing = await storeGet<UserAppData>(key);

      const next: UserAppData = {
        uid,
        dossiers,
        sectors: input.sectors,
        powerGroupings: input.powerGroupings,
        goals: input.goals ?? existing?.goals ?? [],
        goalDirections: input.goalDirections ?? existing?.goalDirections ?? DEFAULT_GOAL_DIRECTIONS,
        updatedAt: Date.now(),
      };

      await storeSet(key, next);

      return {
        ok: true as const,
        updatedAt: next.updatedAt,
        contactsLimited: !limitCheck.allowed,
        maxContacts: limitCheck.maxCount,
        level: limitCheck.level,
      };
    }),

  getMyLevel: publicProcedure.query(async ({ ctx }) => {
    const phone = ctx.userPhone;
    const uid = ctx.userUid;
    if (!phone || !uid) {
      return { ok: false as const, error: "UNAUTHENTICATED" as const };
    }

    const levelData = await getUserLevel(uid);
    const key = userDataKey(uid);
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

  setLevel: publicProcedure
    .input(z.object({
      uid: z.string().min(1),
      level: z.number().min(1).max(2),
      durationDays: z.number().min(1).max(365).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.adminUser) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const subscribedUntil = input.level === 2
        ? Date.now() + (input.durationDays ?? 7) * 24 * 60 * 60 * 1000
        : undefined;

      const result = await setUserLevel(
        input.uid,
        input.level as UserLevel,
        subscribedUntil,
      );

      console.log("[backend] appData.setLevel", {
        admin: ctx.adminUser.username,
        uid: input.uid,
        level: input.level,
        subscribedUntil: result.subscribedUntil,
      });

      return { ok: true as const, levelData: result };
    }),

  getForumProfile: publicProcedure
    .input(z.object({ uid: z.string().min(1) }))
    .query(async ({ input }) => {
      const key = `forum_profile:${input.uid}`;
      const profile = await storeGet<any>(key);
      if (!profile) {
        return { ok: false as const, error: "NOT_FOUND" as const };
      }
      return { ok: true as const, profile };
    }),

  saveForumProfile: publicProcedure
    .input(z.object({
      fullName: z.string().min(1),
      networkingGoals: z.string(),
      competencies: z.string(),
      canBeUseful: z.string(),
      lookingFor: z.string(),
      photoBase64: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userUid) {
        return { ok: false as const, error: "UNAUTHENTICATED" as const };
      }

      const key = `forum_profile:${ctx.userUid}`;
      const profile = {
        ...input,
        uid: ctx.userUid,
        phone: ctx.userPhone,
        createdAt: new Date().toISOString(),
      };
      await storeSet(key, profile);

      const allKey = "forum_profiles_all";
      const all = (await storeGet<Record<string, any>>(allKey)) ?? {};
      all[ctx.userUid] = profile;
      await storeSet(allKey, all);

      console.log("[backend] appData.saveForumProfile", { uid: ctx.userUid, name: input.fullName });
      return { ok: true as const };
    }),

  getAllForumProfiles: publicProcedure.query(async () => {
    const allKey = "forum_profiles_all";
    const all = (await storeGet<Record<string, any>>(allKey)) ?? {};
    return { ok: true as const, profiles: all };
  }),
});
