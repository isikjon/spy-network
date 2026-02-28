import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { storeGet, storeSet, storeDelete } from "../../store";
import { setUserLevel, getUserLevel } from "../utils/user-level";

/**
 * Оплата подписки через YooKassa с поддержкой автопродления.
 *
 * Флоу первой оплаты:
 * 1. createPayment → получаем URL редиректа + save_payment_method: true
 * 2. Пользователь платит → YooKassa сохраняет карту
 * 3. Webhook payment.succeeded → сохраняем payment_method.id + повышаем уровень
 *
 * Автопродление (каждые 7 дней):
 * 4. getUserLevel видит истечение → вызывает chargeRenewal
 * 5. chargeRenewal делает серверный платёж без редиректа
 * 6. Webhook → снова повышаем уровень на 7 дней
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
  isRenewal?: boolean;
};

export type SavedCard = {
  paymentMethodId: string;
  cardLast4: string;
  cardType: string;
  savedAt: number;
};

function paymentKey(paymentId: string): string {
  return `payment:${paymentId}`;
}

function cardKey(phone: string): string {
  return `user:${phone}:payment_method`;
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

function yooKassaHeaders(shopId: string, secretKey: string, idempotenceKey: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`,
    "Idempotence-Key": idempotenceKey,
  };
}

/**
 * Первый платёж — с редиректом на страницу оплаты.
 * save_payment_method: true → ЮКасса сохраняет карту для последующих списаний.
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
      headers: yooKassaHeaders(shopId, secretKey, idempotenceKey),
      body: JSON.stringify({
        amount: { value: PRICE_RUB, currency: "RUB" },
        payment_method_data: { type: "bank_card" },
        confirmation: { type: "redirect", return_url: returnUrl },
        description: `Spy Network ДОПУСК 2 (7 дней) — ${phone}`,
        metadata: { phone },
        capture: true,
        save_payment_method: true,
        receipt: {
          customer: { phone },
          items: [
            {
              description: "Подписка Spy Network — Допуск уровня 2 (7 дней)",
              quantity: "1.00",
              amount: { value: PRICE_RUB, currency: "RUB" },
              vat_code: 1,
              payment_subject: "service",
              payment_mode: "full_payment",
            },
          ],
        },
      }),
    });
    const data = (await res.json()) as any;
    if (!res.ok) {
      console.error("[payment] YooKassa error", data);
      return { ok: false, error: data?.description || "API_ERROR" };
    }
    const confirmationUrl = data?.confirmation?.confirmation_url;
    if (!confirmationUrl) return { ok: false, error: "NO_CONFIRMATION_URL" };
    return { ok: true, paymentId: data.id, confirmationUrl };
  } catch (e: any) {
    console.error("[payment] fetch error", e);
    return { ok: false, error: e?.message || "NETWORK_ERROR" };
  }
}

/**
 * Автоматическое списание по сохранённой карте (без редиректа).
 */
export async function chargeRenewal(phone: string): Promise<boolean> {
  const creds = getYooKassaCredentials();
  if (!creds) {
    console.warn("[payment] chargeRenewal: YooKassa not configured");
    return false;
  }

  const card = await storeGet<SavedCard>(cardKey(phone));
  if (!card?.paymentMethodId) {
    console.log("[payment] chargeRenewal: no saved card for", phone);
    return false;
  }

  const idempotenceKey = `renew_${phone}_${Date.now()}`;
  try {
    const res = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: yooKassaHeaders(creds.shopId, creds.secretKey, idempotenceKey),
      body: JSON.stringify({
        amount: { value: PRICE_RUB, currency: "RUB" },
        payment_method_id: card.paymentMethodId,
        capture: true,
        description: `Spy Network ДОПУСК 2 — автопродление (7 дней) — ${phone}`,
        metadata: { phone, isRenewal: "true" },
        receipt: {
          customer: { phone },
          items: [
            {
              description: "Автопродление Spy Network — Допуск уровня 2 (7 дней)",
              quantity: "1.00",
              amount: { value: PRICE_RUB, currency: "RUB" },
              vat_code: 1,
              payment_subject: "service",
              payment_mode: "full_payment",
            },
          ],
        },
      }),
    });

    const data = (await res.json()) as any;
    if (!res.ok) {
      console.error("[payment] chargeRenewal YooKassa error", { phone, error: data });
      return false;
    }

    const paymentId = data.id as string;
    await storeSet(paymentKey(paymentId), {
      paymentId,
      phone,
      status: "pending",
      createdAt: Date.now(),
      isRenewal: true,
    } as PendingPayment);

    console.log("[payment] chargeRenewal initiated", { phone, paymentId, status: data.status });

    // Если ЮКасса сразу вернула succeeded (бывает при автоплатежах)
    if (data.status === "succeeded") {
      const subscribedUntil = Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;
      await setUserLevel(phone, 2, subscribedUntil);
      console.log("[payment] chargeRenewal: instant success", { phone });
    }

    return true;
  } catch (e: any) {
    console.error("[payment] chargeRenewal fetch error", e);
    return false;
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
      console.warn("[payment] YooKassa not configured");
      return { ok: false as const, error: "NOT_CONFIGURED" as const };
    }

    const returnUrl = `${getBaseUrl()}/app/payment-success`;
    const result = await createYooKassaPayment(ctx.userPhone, creds.shopId, creds.secretKey, returnUrl);

    if (!result.ok) {
      return { ok: false as const, error: (result as { ok: false; error: string }).error };
    }

    await storeSet(paymentKey(result.paymentId), {
      paymentId: result.paymentId,
      phone: ctx.userPhone,
      status: "pending",
      createdAt: Date.now(),
    } as PendingPayment);

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

  /**
   * Получить информацию о сохранённой карте.
   */
  getCardInfo: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userPhone) {
      return { ok: false as const, error: "UNAUTHENTICATED" as const };
    }
    const card = await storeGet<SavedCard>(cardKey(ctx.userPhone));
    const levelData = await getUserLevel(ctx.userPhone);
    return {
      ok: true as const,
      card: card ?? null,
      subscribedUntil: levelData.subscribedUntil,
    };
  }),

  /**
   * Отвязать карту (удалить сохранённый payment method).
   */
  deleteCard: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.userPhone) {
      return { ok: false as const, error: "UNAUTHENTICATED" as const };
    }
    await storeDelete(cardKey(ctx.userPhone));
    console.log("[payment] card deleted for", ctx.userPhone);
    return { ok: true as const };
  }),
});

/**
 * Обработка webhook от YooKassa.
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
  const phone = paymentObj?.metadata?.phone as string;

  if (event === "payment.succeeded") {
    // Повышаем уровень пользователя
    if (phone) {
      const subscribedUntil = Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;
      await setUserLevel(phone, 2, subscribedUntil);
      console.log("[payment] webhook: upgraded to level 2", {
        phone,
        subscribedUntil: new Date(subscribedUntil).toISOString(),
      });

      // Сохраняем данные карты для автопродления
      const pmId = paymentObj?.payment_method?.id as string | undefined;
      const pmSaved = paymentObj?.payment_method?.saved as boolean | undefined;
      const cardLast4 = paymentObj?.payment_method?.card?.last4 as string | undefined;
      const cardType = paymentObj?.payment_method?.card?.card_type as string | undefined;

      if (pmId && pmSaved) {
        const cardData: SavedCard = {
          paymentMethodId: pmId,
          cardLast4: cardLast4 ?? "****",
          cardType: cardType ?? "Unknown",
          savedAt: Date.now(),
        };
        await storeSet(`user:${phone}:payment_method`, cardData);
        console.log("[payment] webhook: card saved", { phone, cardLast4, pmId });
      }
    }

    // Обновляем запись платежа
    const record = await storeGet<PendingPayment>(paymentKey(paymentId));
    if (record) {
      record.status = "succeeded";
      await storeSet(paymentKey(paymentId), record);
    }
    return true;
  }

  if (event === "payment.canceled") {
    const record = await storeGet<PendingPayment>(paymentKey(paymentId));
    if (record) {
      record.status = "canceled";
      await storeSet(paymentKey(paymentId), record);
    }
    console.log("[payment] webhook: canceled", { paymentId });
    return true;
  }

  console.log("[payment] webhook: unhandled event", event);
  return false;
}
