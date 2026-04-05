import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { storeGet, storeSet, storeDelete } from "../../store";
import { createUserSession } from "../utils/user-session";

/**
 * QR-авторизация для веб-версии.
 *
 * Флоу:
 * 1. Веб вызывает createSession → получает sessionId
 * 2. Веб рендерит QR с deeplink: rork-app://qr-confirm?session=<sessionId>
 * 3. Мобилка сканирует QR → открывает экран подтверждения
 * 4. Пользователь нажимает "Разрешить" → мобилка вызывает confirmSession
 * 5. Веб поллит checkSession каждые 2.5 сек → получает token → логинится
 */

type QrSession = {
  sessionId: string;
  status: "pending" | "confirmed" | "rejected";
  phone?: string;
  token?: string;
  createdAt: number;
  expiresAt: number;
};

const QR_TTL_MS = 5 * 60 * 1000; // 5 минут

function qrKey(sessionId: string): string {
  return `qr:session:${sessionId}`;
}

function generateId(len = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < len; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export const qrAuthRouter = createTRPCRouter({
  /**
   * Веб создаёт QR-сессию.
   * Возвращает sessionId — встраивается в QR deeplink.
   */
  createSession: publicProcedure.mutation(async () => {
    const sessionId = generateId(32);
    const now = Date.now();

    const session: QrSession = {
      sessionId,
      status: "pending",
      createdAt: now,
      expiresAt: now + QR_TTL_MS,
    };

    await storeSet(qrKey(sessionId), session);
    console.log("[qr-auth] session created", { sessionId });

    return { ok: true as const, sessionId };
  }),

  /**
   * Веб поллит статус сессии.
   * Если confirmed — возвращает token для входа.
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

      if (session.status === "rejected") {
        await storeDelete(qrKey(input.sessionId));
        return { ok: false as const, error: "REJECTED" as const };
      }

      if (session.status === "confirmed" && session.phone && session.token) {
        await storeDelete(qrKey(input.sessionId));
        return {
          ok: true as const,
          token: session.token,
          phone: session.phone,
        };
      }

      // Ещё pending
      return {
        ok: false as const,
        error: "PENDING" as const,
        expiresAt: session.expiresAt,
      };
    }),

  /**
   * Мобилка подтверждает QR-сессию.
   * Требует авторизации (x-user-auth или x-user-phone).
   */
  confirmSession: publicProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userPhone) {
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

      if (session.status !== "pending") {
        return { ok: false as const, error: "ALREADY_USED" as const };
      }

      // Создаём новую веб-сессию для этого пользователя
      const webSession = await createUserSession(ctx.userPhone);

      session.status = "confirmed";
      session.phone = ctx.userPhone;
      session.token = webSession.token;

      await storeSet(qrKey(input.sessionId), session);
      console.log("[qr-auth] session confirmed by mobile", {
        sessionId: input.sessionId,
        phone: ctx.userPhone,
      });

      return { ok: true as const };
    }),

  /**
   * Мобилка отклоняет QR-сессию.
   */
  rejectSession: publicProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const session = await storeGet<QrSession>(qrKey(input.sessionId));

      if (!session || session.status !== "pending") {
        return { ok: false as const, error: "NOT_FOUND" as const };
      }

      session.status = "rejected";
      await storeSet(qrKey(input.sessionId), session);
      console.log("[qr-auth] session rejected", { sessionId: input.sessionId });

      return { ok: true as const };
    }),

  /**
   * Разработческий вход по секретному ключу.
   * URL: /app/auth?dev=<DEV_SECRET>
   * Номер: +71111111111
   */
  devLogin: publicProcedure
    .input(z.object({ secret: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const expected = process.env.DEV_SECRET || "spy-dev-2026";
      if (input.secret !== expected) {
        console.warn("[qr-auth] devLogin: invalid secret attempt");
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const devPhone = "71111111111";

      // Добавляем тестовую карту для dev-аккаунта, чтобы показать UI отвязки карты
      const { storeGet: get, storeSet: set } = await import("../../store");
      const cardKey = `user:${devPhone}:payment_method`;
      const existing = await get(cardKey);
      if (!existing) {
        await set(cardKey, {
          paymentMethodId: "pm_test_dev_card",
          cardLast4: "4242",
          cardType: "Visa",
          savedAt: Date.now(),
        });
      }

      // Ставим уровень 2 для dev
      const { setUserLevel } = await import("../utils/user-level");
      await setUserLevel(devPhone, 2, Date.now() + 30 * 24 * 60 * 60 * 1000);

      const session = await createUserSession(devPhone);
      console.log("[qr-auth] devLogin: dev session created", { phone: devPhone });

      return { ok: true as const, phone: devPhone, token: session.token };
    }),
});
