import { storeGet, storeSet, storeDelete } from "../../store";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

export type UserSession = {
  token: string;
  phone: string;
  uid: string;
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

export async function createUserSession(phone: string, uid: string): Promise<UserSession> {
  const token = generateToken();
  const now = Date.now();
  const session: UserSession = {
    token,
    phone,
    uid,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  await storeSet(sessionKey(token), session);
  console.log("[user-session] created", { phone, uid, expiresAt: session.expiresAt });
  return session;
}

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

export async function deleteUserSession(token: string): Promise<void> {
  await storeDelete(sessionKey(token));
}

export async function getUserFromRequest(req: Request): Promise<{ phone: string; uid: string } | null> {
  const authHeader = req.headers.get("x-user-auth");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const session = await getUserSession(token);
      if (session) {
        return { phone: session.phone, uid: session.uid ?? "" };
      }
    }
  }

  const phoneHeader = req.headers.get("x-user-phone");
  const uidHeader = req.headers.get("x-user-uid");
  if (phoneHeader && phoneHeader.trim()) {
    return { phone: phoneHeader.trim(), uid: uidHeader?.trim() ?? "" };
  }

  return null;
}
