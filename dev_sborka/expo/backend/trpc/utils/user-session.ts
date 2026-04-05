/**
 * User session management.
 * Сессии хранятся в store (как и админские).
 * Ключ: session:user:<token>
 */

import { storeGet, storeSet, storeDelete } from "../../store";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

export type UserSession = {
  token: string;
  phone: string;
  createdAt: number;
  expiresAt: number;
};

function sessionKey(token: string): string {
  return `session:user:${token}`;
}

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/**
 * Создать сессию для пользователя.
 */
export async function createUserSession(phone: string): Promise<UserSession> {
  const token = generateToken();
  const now = Date.now();
  const session: UserSession = {
    token,
    phone,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  await storeSet(sessionKey(token), session);
  console.log("[user-session] created", { phone, expiresAt: session.expiresAt });
  return session;
}

/**
 * Получить сессию по токену. Возвращает null если не найдена или истекла.
 */
export async function getUserSession(token: string): Promise<UserSession | null> {
  if (!token) return null;
  const session = await storeGet<UserSession>(sessionKey(token));
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    await storeDelete(sessionKey(token));
    return null;
  }
  return session;
}

/**
 * Удалить сессию (логаут).
 */
export async function deleteUserSession(token: string): Promise<void> {
  await storeDelete(sessionKey(token));
}

/**
 * Получить телефон пользователя из заголовка запроса.
 * Поддерживает:
 *   x-user-auth: Bearer <token>  — проверенная сессия
 *   x-user-phone: <phone>        — обратная совместимость (без верификации)
 */
export async function getUserPhoneFromRequest(req: Request): Promise<string | null> {
  // Сначала пробуем токен сессии
  const authHeader = req.headers.get("x-user-auth");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const session = await getUserSession(token);
      if (session) return session.phone;
    }
  }

  // Обратная совместимость: голый номер в заголовке
  const phoneHeader = req.headers.get("x-user-phone");
  if (phoneHeader && phoneHeader.trim()) {
    return phoneHeader.trim();
  }

  return null;
}
