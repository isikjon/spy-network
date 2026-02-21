import * as z from "zod";

import { createTRPCRouter, publicProcedure } from "../create-context";
import { createUserSession } from "../utils/user-session";
import { storeGet, storeSet, storeDelete } from "../../store";

/**
 * QR-авторизация:
 *
 * 1. Веб-клиент вызывает createSession → получает sessionId
 * 2. sessionId кодируется в QR-код и показывается на экране
 * 3. Мобильное приложение (уже авторизованное) сканирует QR
 * 4. Приложение вызывает confirmSession с sessionId + свой токен
 * 5. Бэкенд создаёт веб-сессию для того же пользователя
 * 6. Веб-клиент поллит checkSession → получает токен
 */

type QrSession = {
  sessionId: string;
  status: "pending" | "confirmed";
  phone: string | null;
  webToken: string | null;
  createdAt: number;
  expiresAt: number;
};

const QR_SESSION_TTL_MS = 3 * 60 * 1000; // 3 минуты

function qrKey(sessionId: string): string {
  return `qr:session:${sessionId}`;
}

function generateSessionId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 32; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export const qrAuthRouter = createTRPCRouter({
  /**
   * Шаг 1: Веб создаёт QR-сессию.
   */
  createSession: publicProcedure.mutation(async () => {
    const sessionId = generateSessionId();
    const now = Date.now();

    const session: QrSession = {
      sessionId,
      status: "pending",
      phone: null,
      webToken: null,
      createdAt: now,
      expiresAt: now + QR_SESSION_TTL_MS,
    };

    await storeSet(qrKey(sessionId), session);
    console.log("[qr-auth] session created", { sessionId });

    return {
      ok: true as const,
      sessionId,
      expiresAt: session.expiresAt,
    };
  }),

  /**
   * Шаг 2: Веб поллит статус QR-сессии.
   */
  checkSession: publicProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .query(async ({ input }) => {
      const session = await storeGet<QrSession>(qrKey(input.sessionId));

      if (!session) {
        return { ok: false as const, error: "NOT_FOUND" as const };
      }

      if (Date.now() > session.expiresAt) {
        await storeDelete(qrKey(input.sessionId));
        return { ok: false as const, error: "EXPIRED" as const };
      }

      if (session.status === "confirmed" && session.webToken && session.phone) {
        await storeDelete(qrKey(input.sessionId));
        return {
          ok: true as const,
          token: session.webToken,
          phone: session.phone,
        };
      }

      return { ok: false as const, error: "PENDING" as const };
    }),

  /**
   * Шаг 3: Мобильное приложение подтверждает QR-сессию.
   * Требуется авторизация (x-user-auth заголовок).
   */
  confirmSession: publicProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const phone = ctx.userPhone;
      if (!phone) {
        return { ok: false as const, error: "UNAUTHENTICATED" as const };
      }

      const session = await storeGet<QrSession>(qrKey(input.sessionId));

      if (!session) {
        return { ok: false as const, error: "NOT_FOUND" as const };
      }

      if (Date.now() > session.expiresAt) {
        await storeDelete(qrKey(input.sessionId));
        return { ok: false as const, error: "EXPIRED" as const };
      }

      if (session.status === "confirmed") {
        return { ok: false as const, error: "ALREADY_CONFIRMED" as const };
      }

      const webSession = await createUserSession(phone);

      session.status = "confirmed";
      session.phone = phone;
      session.webToken = webSession.token;
      await storeSet(qrKey(input.sessionId), session);

      console.log("[qr-auth] session confirmed", { sessionId: input.sessionId, phone });

      return { ok: true as const };
    }),
});
