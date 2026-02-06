import * as z from "zod";

import { createTRPCRouter, publicProcedure } from "../create-context";
import { plusofonCallToAuth } from "../utils/plusofon";
import { createUserSession, deleteUserSession } from "../utils/user-session";
import { storeGet, storeSet, storeDelete } from "../../store";

/**
 * Pending-авторизация: ожидаем звонок от пользователя.
 * Ключ: auth:pending:<phone>
 */
type PendingAuth = {
  userPhone: string;
  displayPhone: string;
  key: string;
  verified: boolean;
  createdAt: number;
  expiresAt: number;
};

const PENDING_TTL_MS = 5 * 60 * 1000; // 5 минут

function pendingKey(phone: string): string {
  return `auth:pending:${phone}`;
}

/**
 * Нормализация номера: убираем +, пробелы, скобки, дефисы.
 * Результат: 79XXXXXXXXX
 */
function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }
  if (digits.length === 10) {
    digits = "7" + digits;
  }
  return digits;
}

/**
 * Получить webhook URL из заголовков запроса.
 */
function getWebhookUrl(req: Request): string {
  // Берём origin из запроса или из env
  const envUrl = process.env.WEBHOOK_BASE_URL;
  if (envUrl) return `${envUrl.replace(/\/$/, "")}/auth/webhook/plusofon`;

  try {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}/auth/webhook/plusofon`;
  } catch {
    return "https://spynetwork.ru/auth/webhook/plusofon";
  }
}

export const phoneAuthRouter = createTRPCRouter({
  /**
   * Шаг 1: Запросить обратный Flash Call.
   * Plusofon возвращает номер, на который пользователь должен позвонить.
   */
  requestCall: publicProcedure
    .input(z.object({ phone: z.string().min(10) }))
    .mutation(async ({ input, ctx }) => {
      const phone = normalizePhone(input.phone);

      if (phone.length < 11) {
        return { ok: false as const, error: "INVALID_PHONE" as const };
      }

      // Антиспам: не чаще раза в 60 сек
      const existing = await storeGet<PendingAuth>(pendingKey(phone));
      if (existing && Date.now() < existing.expiresAt) {
        const secondsAgo = Math.floor((Date.now() - existing.createdAt) / 1000);
        if (secondsAgo < 60) {
          // Если уже есть pending — вернуть тот же номер
          return {
            ok: true as const,
            displayPhone: existing.displayPhone,
            phone,
            retryAfter: 60 - secondsAgo,
          };
        }
      }

      // Вызываем Plusofon
      const webhookUrl = getWebhookUrl(ctx.req);
      const result = await plusofonCallToAuth(phone, webhookUrl);

      if (!result.ok) {
        console.error("[phone-auth] plusofon callToAuth failed", result.error);
        return { ok: false as const, error: "SEND_FAILED" as const, detail: result.error };
      }

      // Сохраняем pending
      const pending: PendingAuth = {
        userPhone: phone,
        displayPhone: result.displayPhone,
        key: result.key,
        verified: false,
        createdAt: Date.now(),
        expiresAt: Date.now() + PENDING_TTL_MS,
      };
      await storeSet(pendingKey(phone), pending);

      return {
        ok: true as const,
        displayPhone: result.displayPhone,
        phone,
      };
    }),

  /**
   * Шаг 2: Проверить статус — позвонил ли пользователь.
   * Приложение поллит этот эндпоинт каждые 2-3 секунды.
   * Когда Plusofon присылает вебхук — verified = true.
   */
  checkStatus: publicProcedure
    .input(z.object({ phone: z.string().min(10) }))
    .query(async ({ input }) => {
      const phone = normalizePhone(input.phone);
      const pending = await storeGet<PendingAuth>(pendingKey(phone));

      if (!pending) {
        return { ok: false as const, error: "NOT_FOUND" as const };
      }

      if (Date.now() > pending.expiresAt) {
        await storeDelete(pendingKey(phone));
        return { ok: false as const, error: "EXPIRED" as const };
      }

      if (!pending.verified) {
        return { ok: false as const, error: "WAITING" as const };
      }

      // Верифицирован! Создаём сессию.
      await storeDelete(pendingKey(phone));
      const session = await createUserSession(phone);

      return {
        ok: true as const,
        token: session.token,
        phone: session.phone,
        expiresAt: session.expiresAt,
      };
    }),

  /**
   * Получить текущую сессию.
   */
  me: publicProcedure.query(async ({ ctx }) => {
    const phone = ctx.userPhone;
    if (!phone) {
      return { ok: false as const, error: "UNAUTHENTICATED" as const };
    }
    return { ok: true as const, phone };
  }),

  /**
   * Выйти (удалить сессию).
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get("x-user-auth");
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (token) {
        await deleteUserSession(token);
      }
    }
    return { ok: true as const };
  }),
});

/**
 * Обработка вебхука от Plusofon.
 * Plusofon POST-ит сюда когда пользователь позвонил на номер.
 * Мы помечаем pending как verified.
 */
export async function handlePlusofonWebhook(body: Record<string, unknown>): Promise<boolean> {
  console.log("[phone-auth] webhook received", body);

  // Plusofon присылает phone (номер пользователя) и key
  const userPhone = String(body.phone || body.caller || "").replace(/[^0-9]/g, "");
  const key = String(body.key || body.request_key || "");

  if (!userPhone) {
    console.warn("[phone-auth] webhook: no phone in body");
    return false;
  }

  // Ищем pending по номеру
  const pending = await storeGet<PendingAuth>(pendingKey(userPhone));
  if (!pending) {
    console.warn("[phone-auth] webhook: no pending for", userPhone);
    return false;
  }

  if (Date.now() > pending.expiresAt) {
    await storeDelete(pendingKey(userPhone));
    console.warn("[phone-auth] webhook: pending expired for", userPhone);
    return false;
  }

  // Помечаем как верифицированный
  pending.verified = true;
  await storeSet(pendingKey(userPhone), pending);
  console.log("[phone-auth] webhook: verified", userPhone);
  return true;
}
