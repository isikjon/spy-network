/**
 * Plusofon Обратный Flash Call API client
 * Документация: https://help.plusofon.ru/api/v1/flash-call#post_call-to-auth
 *
 * Обратный Flash Call — полный флоу:
 *
 *   1. POST /api/v1/flash-call/call-to-auth
 *      Headers: Authorization: Bearer <FC_TOKEN>, client: 10553
 *      Body: { phone, hook_url }
 *
 *   2. Plusofon шлёт вебхук на hook_url с данными:
 *      - phone — номер, на который должен позвонить пользователь
 *      - key   — ключ для проверки
 *
 *   3. Пользователь звонит на этот номер.
 *
 *   4. Plusofon шлёт второй вебхук — подтверждение звонка.
 *
 * Вебхуки приходят с IP: 185.54.48.1
 */

const BASE = "https://restapi.plusofon.ru";
const CLIENT_ID = "10553"; // всегда 10553 (из документации), передаётся в headers

/** Flash Call access_token — единственный токен для этого эндпоинта */
function getFcToken(): string {
  const t = process.env.PLUSOFON_FC_TOKEN;
  if (!t) throw new Error("PLUSOFON_FC_TOKEN env is not set");
  return t;
}

export type CallToAuthResult =
  | { ok: true; displayPhone: string; key: string }
  | { ok: false; error: string; statusCode: number; raw: unknown };

/**
 * Запросить обратный Flash Call.
 *
 * @param userPhone — номер пользователя (79XXXXXXXXX)
 * @param hookUrl — URL вебхука
 */
export async function plusofonCallToAuth(
  userPhone: string,
  hookUrl: string,
): Promise<CallToAuthResult> {
  const fcToken = getFcToken();
  const url = `${BASE}/api/v1/flash-call/call-to-auth`;

  const requestBody = {
    phone: userPhone,
    hook_url: hookUrl,
  };

  console.log("[plusofon] callToAuth REQUEST", {
    url,
    phone: userPhone,
    hookUrl,
    fcTokenPrefix: fcToken.slice(0, 6) + "...",
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${fcToken}`,
        "client": CLIENT_ID,
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

    // Успех — Plusofon вернул номер для звонка и ключ
    const respData = data as { data?: { phone?: string; key?: string } };
    const displayPhone = respData?.data?.phone || "";
    const key = respData?.data?.key || "";

    if (!displayPhone) {
      return { ok: false, error: "NO_PHONE_IN_RESPONSE", statusCode: res.status, raw: data };
    }

    return { ok: true, displayPhone, key };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[plusofon] callToAuth NETWORK ERROR", msg);
    return { ok: false, error: msg, statusCode: 0, raw: null };
  }
}
