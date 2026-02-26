import * as z from "zod";

import { storeGet, storeSet, storeDelete } from "@/backend/store";
import { createTRPCRouter, publicProcedure } from "../create-context";

type QrSession = {
  sessionId: string;
  status: "pending" | "confirmed";
  phone: string | null;
  createdAt: number;
};

const SESSION_TTL_MS = 5 * 60 * 1000;
const qrSessionKey = (id: string) => `qr_session:${id}`;

function generateSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export const qrAuthRouter = createTRPCRouter({
  createSession: publicProcedure.mutation(async () => {
    const sessionId = generateSessionId();
    console.log("[backend] qrAuth.createSession", { sessionId });

    const session: QrSession = {
      sessionId,
      status: "pending",
      phone: null,
      createdAt: Date.now(),
    };

    await storeSet(qrSessionKey(sessionId), session);

    return { sessionId };
  }),

  checkSession: publicProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .query(async ({ input }) => {
      const { sessionId } = input;
      console.log("[backend] qrAuth.checkSession", { sessionId });

      const session = await storeGet<QrSession>(qrSessionKey(sessionId));

      if (!session) {
        return { status: "expired" as const, phone: null };
      }

      if (Date.now() - session.createdAt > SESSION_TTL_MS) {
        await storeDelete(qrSessionKey(sessionId));
        return { status: "expired" as const, phone: null };
      }

      if (session.status === "confirmed" && session.phone) {
        await storeDelete(qrSessionKey(sessionId));
        return { status: "confirmed" as const, phone: session.phone };
      }

      return { status: "pending" as const, phone: null };
    }),

  confirmSession: publicProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const phone = ctx.userPhone;
      const { sessionId } = input;

      console.log("[backend] qrAuth.confirmSession", { sessionId, phone });

      if (!phone) {
        return { ok: false as const, error: "NOT_AUTHENTICATED" as const };
      }

      const session = await storeGet<QrSession>(qrSessionKey(sessionId));

      if (!session) {
        return { ok: false as const, error: "SESSION_NOT_FOUND" as const };
      }

      if (Date.now() - session.createdAt > SESSION_TTL_MS) {
        await storeDelete(qrSessionKey(sessionId));
        return { ok: false as const, error: "SESSION_EXPIRED" as const };
      }

      const updated: QrSession = {
        ...session,
        status: "confirmed",
        phone,
      };

      await storeSet(qrSessionKey(sessionId), updated);

      return { ok: true as const };
    }),
});
