/**
 * Plusofon Обратный Flash Call API client
 * Документация: https://help.plusofon.ru/Услуги/Flash_Call#обратный-flash-call
 *
 * Обратный Flash Call — полный флоу:
 *
 *   1. POST /api/v1/flash-call/call-to-auth
 *      Параметры: client, phone, access_token, webhook_url
 *      Plusofon принимает запрос.
 *
 *   2. Plusofon шлёт ПЕРВЫЙ вебхук на webhook_url с данными:
 *      - phone — номер, на который должен позвонить пользователь
 *      - key   — ключ для проверки
 *
 *   3. Пользователь звонит на этот номер.
 *
 *   4. Plusofon шлёт ВТОРОЙ вебхук — подтверждение успешного звонка.
 *
 * Вебхуки приходят с IP: 185.54.48.1
 */

const BASE = "https://restapi.plusofon.ru";
const CLIENT_ID = 10553; // всегда 10553 (из документации)

function getToken(): string {
  const t = process.env.PLUSOFON_TOKEN;
  if (!t) throw new Error("PLUSOFON_TOKEN env is not set");
  return t;
}

export type CallToAuthResult =
  | { ok: true; requestAccepted: true }
  | { ok: false; error: string; statusCode: number; raw: unknown };

/**
 * Запросить обратный Flash Call.
 * Plusofon НЕ возвращает номер в ответе — номер придёт через вебхук.
 *
 * @param userPhone — номер пользователя (79XXXXXXXXX)
 * @param webhookUrl — URL вебхука (два вебхука: 1) номер для звонка, 2) подтверждение)
 */
export async function plusofonCallToAuth(
  userPhone: string,
  webhookUrl: string,
): Promise<CallToAuthResult> {
  const token = getToken();
  const url = `${BASE}/api/v1/flash-call/call-to-auth`;

  const requestBody = {
    client: CLIENT_ID,
    phone: userPhone,
    access_token: token,
    webhook_url: webhookUrl,
  };

  console.log("[plusofon] callToAuth REQUEST", {
    url,
    phone: userPhone,
    webhookUrl,
    tokenLength: token.length,
    tokenPrefix: token.slice(0, 6) + "...",
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    let data: unknown;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    console.log("[plusofon] callToAuth RESPONSE", {
      status: res.status,
      contentType: res.headers.get("content-type"),
      data,
    });

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data === "object" && data !== null
          ? String((data as any).error || (data as any).message || JSON.stringify(data))
          : String(data),
        statusCode: res.status,
        raw: data,
      };
    }

    // Успех — Plusofon принял запрос. Номер придёт через вебхук.
    return { ok: true, requestAccepted: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[plusofon] callToAuth NETWORK ERROR", msg);
    return { ok: false, error: msg, statusCode: 0, raw: null };
  }
}
