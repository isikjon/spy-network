import * as z from "zod";

import { createTRPCRouter, publicProcedure } from "../create-context";
import { plusofonCallToAuth } from "../utils/plusofon";
import { createUserSession, deleteUserSession } from "../utils/user-session";
import { storeGet, storeSet, storeDelete } from "../../store";

/**
 * Обратный Flash Call — полный флоу:
 *
 * 1. Пользователь вводит номер → app вызывает requestCall
 * 2. Бэкенд отправляет POST call-to-auth в Plusofon
 * 3. Plusofon шлёт ПЕРВЫЙ вебхук → мы получаем номер для звонка (displayPhone)
 * 4. App поллит checkStatus → видит displayPhone → показывает пользователю
 * 5. Пользователь звонит на номер
 * 6. Plusofon шлёт ВТОРОЙ вебхук → подтверждение звонка → verified = true
 * 7. App поллит checkStatus → видит verified → получает токен сессии
 */

/**
 * Pending-авторизация.
 * Ключ: auth:pending:<phone>
 */
type PendingAuth = {
  userPhone: string;
  /** Номер для звонка — приходит через вебхук от Plusofon */
  displayPhone: string | null;
  /** Ключ проверки — приходит через вебхук от Plusofon */
  key: string | null;
  /** Звонок подтверждён — приходит через второй вебхук */
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
 * Получить webhook URL.
 */
function getWebhookUrl(): string {
  const envUrl = process.env.WEBHOOK_BASE_URL;
  if (envUrl) return `${envUrl.replace(/\/$/, "")}/auth/webhook/plusofon`;
  return "https://spynetwork.ru/auth/webhook/plusofon";
}

export const phoneAuthRouter = createTRPCRouter({
  /**
   * Шаг 1: Запросить обратный Flash Call.
   * Plusofon примет запрос. Номер для звонка придёт через вебхук.
   */
  requestCall: publicProcedure
    .input(z.object({ phone: z.string().min(10) }))
    .mutation(async ({ input }) => {
      const phone = normalizePhone(input.phone);

      if (phone.length < 11) {
        return { ok: false as const, error: "INVALID_PHONE" as const };
      }

      // Антиспам: не чаще раза в 60 сек
      const existing = await storeGet<PendingAuth>(pendingKey(phone));
      if (existing && Date.now() < existing.expiresAt) {
        const secondsAgo = Math.floor((Date.now() - existing.createdAt) / 1000);
        if (secondsAgo < 60) {
          return {
            ok: true as const,
            status: "already_requested" as const,
            phone,
            retryAfter: 60 - secondsAgo,
            // Если вебхук уже пришёл — вернём номер
            displayPhone: existing.displayPhone,
          };
        }
      }

      // Вызываем Plusofon
      const webhookUrl = getWebhookUrl();
      console.log("[phone-auth] requesting call-to-auth", { phone, webhookUrl });
      const result = await plusofonCallToAuth(phone, webhookUrl);

      if (!result.ok) {
        const errMsg = (result as { ok: false; error: string }).error;
        console.error("[phone-auth] plusofon callToAuth failed", errMsg);
        return { ok: false as const, error: "SEND_FAILED" as const, detail: errMsg };
      }

      // Номер для звонка пришёл сразу в ответе API!
      const displayPhone = (result as { ok: true; displayPhone: string }).displayPhone;
      const key = (result as { ok: true; key: string }).key;

      // Форматируем номер: 79675180075 → 8-967-518-00-75
      let formattedPhone = displayPhone;
      const digits = displayPhone.replace(/[^0-9]/g, "");
      if (digits.length === 11) {
        formattedPhone = `8-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
      }

      const pending: PendingAuth = {
        userPhone: phone,
        displayPhone: formattedPhone,
        key,
        verified: false,
        createdAt: Date.now(),
        expiresAt: Date.now() + PENDING_TTL_MS,
      };
      await storeSet(pendingKey(phone), pending);

      return {
        ok: true as const,
        status: "requested" as const,
        phone,
        displayPhone: formattedPhone,
      };
    }),

  /**
   * Шаг 2: Проверить статус авторизации.
   * App поллит каждые 2-3 секунды.
   *
   * Возможные статусы:
   * - waiting_call: номер получен, ждём звонок от пользователя
   * - verified: звонок подтверждён, вот токен
   * - expired / not_found: ошибка
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

      // Номер есть, но звонок ещё не подтверждён
      if (!pending.verified) {
        return {
          ok: false as const,
          error: "WAITING_CALL" as const,
          displayPhone: pending.displayPhone,
        };
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
 * Обработка вебхуков от Plusofon.
 *
 * ПЕРВЫЙ вебхук: Plusofon присылает номер для звонка.
 *   body: { phone: "8XXXXXXXXXX", key: "abc123" }
 *   — phone это номер для звонка (служебный), НЕ номер пользователя
 *
 * ВТОРОЙ вебхук: подтверждение, что пользователь позвонил.
 *   body: { ... подтверждение ... }
 *
 * Проблема: в первом вебхуке phone — это служебный номер,
 * а нам нужно сопоставить с номером пользователя.
 * Решение: ищем среди всех pending авторизаций.
 */
export async function handlePlusofonWebhook(body: Record<string, unknown>): Promise<boolean> {
  console.log("[phone-auth] WEBHOOK received:", JSON.stringify(body, null, 2));

  const webhookPhone = String(body.phone || "").replace(/[^0-9]/g, "");
  const key = String(body.key || "");
  const status = body.status || body.result || body.event;

  console.log("[phone-auth] webhook parsed:", { webhookPhone, key, status, bodyKeys: Object.keys(body) });

  // Перебираем все pending авторизации и ищем совпадение
  const { storeGetAll } = await import("../../store");
  const allKeys = await storeGetAll<PendingAuth>("auth:pending:");

  for (const [storeKey, pending] of Object.entries(allKeys)) {
    if (Date.now() > pending.expiresAt) {
      continue;
    }

    // ПЕРВЫЙ вебхук: номер для звонка ещё не получен
    if (!pending.displayPhone && webhookPhone && key) {
      // Plusofon присылает номер для звонка — сохраняем
      pending.displayPhone = webhookPhone.length >= 7 ? webhookPhone : null;
      pending.key = key;

      // Форматируем номер для отображения
      if (pending.displayPhone) {
        // Если 11 цифр начинается с 8 — форматируем как 8-XXX-XXX-XX-XX
        if (pending.displayPhone.length === 11 && pending.displayPhone.startsWith("8")) {
          const d = pending.displayPhone;
          pending.displayPhone = `8-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
        }
      }

      await storeSet(storeKey, pending);
      console.log("[phone-auth] webhook: stored displayPhone for", pending.userPhone, "→", pending.displayPhone);
      return true;
    }

    // ВТОРОЙ вебхук: подтверждение звонка (номер уже есть, ещё не verified)
    if (pending.displayPhone && !pending.verified) {
      // Проверяем — это подтверждение звонка (может содержать статус, или key совпадает)
      const isConfirmation =
        status === "success" ||
        status === "confirmed" ||
        status === "completed" ||
        (key && pending.key && key === pending.key) ||
        // Если phone в вебхуке совпадает с номером пользователя — это подтверждение
        (webhookPhone === pending.userPhone);

      if (isConfirmation) {
        pending.verified = true;
        await storeSet(storeKey, pending);
        console.log("[phone-auth] webhook: VERIFIED", pending.userPhone);
        return true;
      }
    }
  }

  console.warn("[phone-auth] webhook: no matching pending auth found");
  return false;
}
