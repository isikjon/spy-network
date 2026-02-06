/**
 * Plusofon Обратный Flash Call API client
 * Документация: https://help.plusofon.ru/Услуги/Flash_Call#обратный-flash-call
 *
 * Обратный Flash Call:
 *   1. POST /api/v1/flash-call/call-to-auth — запросить номер для звонка
 *      Plusofon возвращает номер, на который должен позвонить пользователь
 *   2. Пользователь звонит на этот номер
 *   3. Plusofon шлёт вебхук на наш сервер — подтверждение звонка
 */

const BASE = "https://restapi.plusofon.ru";
const CLIENT_ID = 10553; // всегда 10553 (из документации)

function getToken(): string {
  const t = process.env.PLUSOFON_TOKEN;
  if (!t) throw new Error("PLUSOFON_TOKEN env is not set");
  return t;
}

export type CallToAuthResult =
  | { ok: true; displayPhone: string; key: string }
  | { ok: false; error: string };

/**
 * Запросить обратный Flash Call.
 * Plusofon вернёт номер, на который пользователь должен позвонить.
 *
 * @param userPhone — номер пользователя (79XXXXXXXXX)
 * @param webhookUrl — URL вебхука куда Plusofon пришлёт подтверждение
 */
export async function plusofonCallToAuth(
  userPhone: string,
  webhookUrl: string,
): Promise<CallToAuthResult> {
  const token = getToken();
  const url = `${BASE}/api/v1/flash-call/call-to-auth`;

  console.log("[plusofon] callToAuth", { userPhone, webhookUrl });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: CLIENT_ID,
        phone: userPhone,
        webhook_url: webhookUrl,
        access_token: token,
      }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    console.log("[plusofon] callToAuth response", { status: res.status, data });

    if (!res.ok || data.error) {
      return {
        ok: false,
        error: String(data.error || data.message || `HTTP ${res.status}`),
      };
    }

    // Plusofon возвращает номер для звонка и ключ
    const displayPhone = String(data.phone || data.call_phone || "");
    const key = String(data.key || data.request_key || data.id || "");

    if (!displayPhone) {
      return { ok: false, error: "NO_PHONE_IN_RESPONSE" };
    }

    return { ok: true, displayPhone, key };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[plusofon] callToAuth error", msg);
    return { ok: false, error: msg };
  }
}
