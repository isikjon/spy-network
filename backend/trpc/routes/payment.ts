import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { storeGet, storeSet } from "../../store";
import { setUserLevel } from "../utils/user-level";

/**
 * Оплата подписки через YooKassa (ЮКасса).
 *
 * Флоу:
 * 1. Клиент вызывает createPayment
 * 2. Бэкенд создаёт платёж в YooKassa → возвращает URL редиректа
 * 3. Пользователь оплачивает на сайте YooKassa
 * 4. YooKassa шлёт webhook → бэкенд обновляет уровень пользователя
 * 5. Клиент поллит checkPayment → видит статус "succeeded" → показывает успех
 *
 * Env vars:
 *   YOOKASSA_SHOP_ID   — ID магазина
 *   YOOKASSA_SECRET_KEY — секретный ключ
 *   APP_BASE_URL        — базовый URL приложения (https://spynetwork.ru)
 *
 * Цена: 99 руб / 7 дней
 */

const PRICE_RUB = "99.00";
const SUBSCRIPTION_DAYS = 7;

type PendingPayment = {
  paymentId: string;
  phone: string;
  status: "pending" | "succeeded" | "canceled";
  createdAt: number;
};

function paymentKey(paymentId: string): string {
  return `payment:${paymentId}`;
}

function getYooKassaCredentials(): { shopId: string; secretKey: string } | null {
  const shopId = process.env.YOOKASSA_SHOP_ID ?? process.env.YUKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY ?? process.env.YUKASSA_SECRET_KEY;
  if (!shopId || !secretKey) return null;
  return { shopId, secretKey };
}

function getBaseUrl(): string {
  return (process.env.APP_BASE_URL || "https://spynetwork.ru").replace(/\/$/, "");
}

/**
 * Создать платёж в YooKassa REST API.
 */
async function createYooKassaPayment(
  phone: string,
  shopId: string,
  secretKey: string,
  returnUrl: string,
): Promise<{ ok: true; paymentId: string; confirmationUrl: string } | { ok: false; error: string }> {
  const idempotenceKey = `pay_${phone}_${Date.now()}`;

  try {
    const res = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`,
        "Idempotence-Key": idempotenceKey,
      },
      body: JSON.stringify({
        amount: { value: PRICE_RUB, currency: "RUB" },
        payment_method_data: { type: "bank_card" },
        confirmation: { type: "redirect", return_url: returnUrl },
        description: `Spy Network ДОПУСК 2 (7 дней) — ${phone}`,
        metadata: { phone },
        capture: true,
      }),
    });

    const data = (await res.json()) as any;

    if (!res.ok) {
      console.error("[payment] YooKassa error", data);
      return { ok: false, error: data?.description || "API_ERROR" };
    }

    const confirmationUrl = data?.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      return { ok: false, error: "NO_CONFIRMATION_URL" };
    }

    return { ok: true, paymentId: data.id, confirmationUrl };
  } catch (e: any) {
    console.error("[payment] fetch error", e);
    return { ok: false, error: e?.message || "NETWORK_ERROR" };
  }
}

export const paymentRouter = createTRPCRouter({
  /**
   * Создать платёж. Возвращает URL для редиректа на страницу оплаты.
   */
  createPayment: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.userPhone) {
      return { ok: false as const, error: "UNAUTHENTICATED" as const };
    }

    const creds = getYooKassaCredentials();
    if (!creds) {
      console.warn("[payment] YooKassa not configured (YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY missing)");
      return { ok: false as const, error: "NOT_CONFIGURED" as const };
    }

    const returnUrl = `${getBaseUrl()}/payment/success`;
    const result = await createYooKassaPayment(ctx.userPhone, creds.shopId, creds.secretKey, returnUrl);

    if (!result.ok) {
      const errResult = result as { ok: false; error: string };
      return { ok: false as const, error: errResult.error };
    }

    const pending: PendingPayment = {
      paymentId: result.paymentId,
      phone: ctx.userPhone,
      status: "pending",
      createdAt: Date.now(),
    };
    await storeSet(paymentKey(result.paymentId), pending);

    console.log("[payment] created", { phone: ctx.userPhone, paymentId: result.paymentId });

    return {
      ok: true as const,
      paymentId: result.paymentId,
      paymentUrl: result.confirmationUrl,
    };
  }),

  /**
   * Проверить статус платежа (поллинг с клиента).
   */
  checkPayment: publicProcedure
    .input(z.object({ paymentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userPhone) {
        return { ok: false as const, error: "UNAUTHENTICATED" as const };
      }

      const record = await storeGet<PendingPayment>(paymentKey(input.paymentId));

      if (!record || record.phone !== ctx.userPhone) {
        return { ok: false as const, error: "NOT_FOUND" as const };
      }

      return { ok: true as const, status: record.status };
    }),
});

/**
 * Обработка webhook от YooKassa.
 * Вызывается из hono.ts: POST /payment/webhook/yookassa
 */
export async function handleYooKassaWebhook(body: Record<string, unknown>): Promise<boolean> {
  console.log("[payment] webhook received", JSON.stringify(body, null, 2));

  const event = body?.event as string;
  const paymentObj = (body?.object as any);

  if (!paymentObj?.id) {
    console.warn("[payment] webhook: no payment object");
    return false;
  }

  const paymentId = paymentObj.id as string;
  const record = await storeGet<PendingPayment>(paymentKey(paymentId));

  if (!record) {
    console.warn("[payment] webhook: unknown paymentId", paymentId);
    return false;
  }

  if (event === "payment.succeeded") {
    record.status = "succeeded";
    await storeSet(paymentKey(paymentId), record);

    // Повышаем уровень пользователя на 7 дней
    const subscribedUntil = Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;
    await setUserLevel(record.phone, 2, subscribedUntil);

    console.log("[payment] webhook: succeeded, upgraded to level 2", {
      phone: record.phone,
      subscribedUntil: new Date(subscribedUntil).toISOString(),
    });
    return true;
  }

  if (event === "payment.canceled") {
    record.status = "canceled";
    await storeSet(paymentKey(paymentId), record);
    console.log("[payment] webhook: canceled", { paymentId });
    return true;
  }

  console.log("[payment] webhook: unhandled event", event);
  return false;
}
