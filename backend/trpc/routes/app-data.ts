import * as z from "zod";

import type { ContactDossier } from "@/types";
import { storeGet, storeSet } from "@/backend/store";
import { createTRPCRouter, publicProcedure } from "../create-context";

const userDataKey = (phone: string) => `user:${phone}:data`;

const ContactRelationSchema = z.object({
  contactId: z.string().min(1),
  strength: z.number().int().min(0).max(100),
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

const ContactDossierSchema: z.ZodType<ContactDossier> = z.object({
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
});

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

      const next: UserAppData = {
        phoneNumber: phone,
        dossiers: input.dossiers,
        sectors: input.sectors,
        powerGroupings: input.powerGroupings,
        updatedAt: Date.now(),
      };

      const key = userDataKey(phone);
      await storeSet(key, next);

      return { ok: true as const, updatedAt: next.updatedAt };
    }),
});
