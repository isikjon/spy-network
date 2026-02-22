import * as z from "zod";

import { createTRPCRouter, publicProcedure } from "../create-context";
import { storeGet, storeSet, storeDelete } from "../../store";
import { setUserLevel, getUserLevel } from "../utils/user-level";

const YUKASSA_API = "https://api.yookassa.ru/v3";
const SUBSCRIPTION_PRICE = "99.00";
const SUBSCRIPTION_CURRENCY = "RUB";
const SUBSCRIPTION_DAYS = 7;

type SubscriptionData = {
  phone: string;
  paymentMethodId: string | null;
  autoRenew: boolean;
  lastPaymentId: string | null;
  lastPaymentAt: number | null;
  createdAt: number;
};

type PaymentRecord = {
  paymentId: string;
  phone: string;
  status: string;
  amount: string;
  createdAt: number;
  confirmedAt: number | null;
};

function subscriptionKey(phone: string): string {
  return `subscription:${phone}`;
}

function paymentKey(paymentId: string): string {
  return `payment:${paymentId}`;
}

function getYuKassaCredentials(): { shopId: string; secretKey: string } {
  const shopId = process.env.YUKASSA_SHOP_ID;
  const secretKey = process.env.YUKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    throw new Error("YUKASSA_SHOP_ID and YUKASSA_SECRET_KEY must be set");
  }
  return { shopId, secretKey };
}

function generateIdempotencyKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

async function yukassaRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { shopId, secretKey } = getYuKassaCredentials();
  const authHeader = "Basic " + btoa(`${shopId}:${secretKey}`);

  const headers: Record<string, string> = {
    Authorization: authHeader,
    "Content-Type": "application/json",
  };

  if (method === "POST") {
    headers["Idempotence-Key"] = generateIdempotencyKey();
  }

  const res = await fetch(`${YUKASSA_API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[payment] YuKassa API error", { status: res.status, data });
    throw new Error(`YuKassa API error: ${res.status}`);
  }

  return data as T;
}

export const paymentRouter = createTRPCRouter({
  createPayment: publicProcedure
    .input(z.object({
      returnUrl: z.string().url().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const phone = ctx.userPhone;
      if (!phone) {
        return { ok: false as const, error: "UNAUTHENTICATED" as const };
      }

      const levelData = await getUserLevel(phone);
      if (levelData.level >= 2 && levelData.subscribedUntil && Date.now() < levelData.subscribedUntil) {
        return { ok: false as const, error: "ALREADY_SUBSCRIBED" as const };
      }

      const returnUrl = input?.returnUrl || "https://spynetwork.ru/account.html?payment=success";

      try {
        const sub = await storeGet<SubscriptionData>(subscriptionKey(phone));

        const customerPhone = phone.startsWith("7") ? phone : "7" + phone;

        const paymentBody: Record<string, unknown> = {
          amount: { value: SUBSCRIPTION_PRICE, currency: SUBSCRIPTION_CURRENCY },
          confirmation: { type: "redirect", return_url: returnUrl },
          capture: true,
          description: `Spy Network — Уровень 2 (${SUBSCRIPTION_DAYS} дней)`,
          metadata: { phone, type: "initial" },
          receipt: {
            customer: { phone: customerPhone },
            items: [
              {
                description: "Подписка Spy Network — Уровень 2 (7 дней)",
                quantity: "1.00",
                amount: { value: SUBSCRIPTION_PRICE, currency: SUBSCRIPTION_CURRENCY },
                vat_code: 1,
                payment_subject: "service",
                payment_mode: "full_payment",
              },
            ],
          },
        };

        const payment = await yukassaRequest<{
          id: string;
          status: string;
          confirmation?: { confirmation_url: string };
        }>("POST", "/payments", paymentBody);

        console.log("[payment] created", { paymentId: payment.id, phone, status: payment.status });

        const record: PaymentRecord = {
          paymentId: payment.id,
          phone,
          status: payment.status,
          amount: SUBSCRIPTION_PRICE,
          createdAt: Date.now(),
          confirmedAt: null,
        };
        await storeSet(paymentKey(payment.id), record);

        if (payment.status === "succeeded") {
          await activateSubscription(phone, payment.id, null);
          return { ok: true as const, status: "succeeded" as const };
        }

        return {
          ok: true as const,
          status: "pending" as const,
          paymentId: payment.id,
          confirmationUrl: payment.confirmation?.confirmation_url || null,
        };
      } catch (e: any) {
        console.error("[payment] createPayment error", e);
        return { ok: false as const, error: "PAYMENT_ERROR" as const, detail: e.message };
      }
    }),

  getStatus: publicProcedure.query(async ({ ctx }) => {
    const phone = ctx.userPhone;
    if (!phone) {
      return { ok: false as const, error: "UNAUTHENTICATED" as const };
    }

    const levelData = await getUserLevel(phone);
    const sub = await storeGet<SubscriptionData>(subscriptionKey(phone));

    return {
      ok: true as const,
      level: levelData.level,
      subscribedUntil: levelData.subscribedUntil,
      autoRenew: sub?.autoRenew ?? false,
      hasPaymentMethod: !!sub?.paymentMethodId,
    };
  }),

  cancelAutoRenew: publicProcedure.mutation(async ({ ctx }) => {
    const phone = ctx.userPhone;
    if (!phone) {
      return { ok: false as const, error: "UNAUTHENTICATED" as const };
    }

    const sub = await storeGet<SubscriptionData>(subscriptionKey(phone));
    if (sub) {
      sub.autoRenew = false;
      await storeSet(subscriptionKey(phone), sub);
      console.log("[payment] auto-renew cancelled", { phone });
    }

    return { ok: true as const };
  }),
});

export async function activateSubscription(
  phone: string,
  paymentId: string,
  paymentMethodId: string | null,
): Promise<void> {
  const subscribedUntil = Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;
  await setUserLevel(phone, 2, subscribedUntil);

  const existing = await storeGet<SubscriptionData>(subscriptionKey(phone));

  const sub: SubscriptionData = {
    phone,
    paymentMethodId: paymentMethodId || existing?.paymentMethodId || null,
    autoRenew: true,
    lastPaymentId: paymentId,
    lastPaymentAt: Date.now(),
    createdAt: existing?.createdAt || Date.now(),
  };
  await storeSet(subscriptionKey(phone), sub);

  const record = await storeGet<PaymentRecord>(paymentKey(paymentId));
  if (record) {
    record.status = "succeeded";
    record.confirmedAt = Date.now();
    await storeSet(paymentKey(paymentId), record);
  }

  console.log("[payment] subscription activated", { phone, subscribedUntil: new Date(subscribedUntil).toISOString() });
}

export async function handleYuKassaWebhook(body: Record<string, unknown>): Promise<boolean> {
  const event = body.event as string;
  const object = body.object as Record<string, unknown>;

  if (!object || !event) {
    console.log("[payment] webhook: invalid body");
    return false;
  }

  const paymentId = object.id as string;
  const status = object.status as string;
  const metadata = object.metadata as Record<string, string> | undefined;
  const phone = metadata?.phone;

  console.log("[payment] webhook", { event, paymentId, status, phone });

  if (!phone) {
    console.log("[payment] webhook: no phone in metadata");
    return false;
  }

  if (event === "payment.succeeded" && status === "succeeded") {
    const paymentMethod = object.payment_method as Record<string, unknown> | undefined;
    const savedMethodId = paymentMethod?.saved === true ? (paymentMethod.id as string) : null;

    await activateSubscription(phone, paymentId, savedMethodId);
    return true;
  }

  if (event === "payment.canceled") {
    const record = await storeGet<PaymentRecord>(paymentKey(paymentId));
    if (record) {
      record.status = "canceled";
      await storeSet(paymentKey(paymentId), record);
    }
    console.log("[payment] payment canceled", { paymentId, phone });
    return true;
  }

  return true;
}
