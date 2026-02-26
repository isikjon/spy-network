import { storeGet, storeSet, storeDelete } from "@/backend/store";

export type AdminRole = "admin" | "analyst" | "manager";
export type AdminUser = { username: string; role: AdminRole };

export type AdminRecord = {
  username: string;
  password: string;
  role: AdminRole;
  updatedAt: number;
};

type AdminSession = {
  token: string;
  username: string;
  role: AdminRole;
  createdAt: number;
  expiresAt: number;
};

export const adminUserKey = (username: string) => `admin:user:${username}`;
const adminSessionKey = (token: string) => `admin:session:${token}`;

const ADMIN_AUTH_SECRET =
  typeof process.env.RORK_ADMIN_AUTH_SECRET === "string" &&
  process.env.RORK_ADMIN_AUTH_SECRET.length > 0
    ? process.env.RORK_ADMIN_AUTH_SECRET
    : null;

const ADMIN_DEFAULT_USERNAME =
  typeof process.env.RORK_ADMIN_DEFAULT_USERNAME === "string" &&
  process.env.RORK_ADMIN_DEFAULT_USERNAME.length > 0
    ? process.env.RORK_ADMIN_DEFAULT_USERNAME
    : null;

const ADMIN_DEFAULT_PASSWORD =
  typeof process.env.RORK_ADMIN_DEFAULT_PASSWORD === "string" &&
  process.env.RORK_ADMIN_DEFAULT_PASSWORD.length > 0
    ? process.env.RORK_ADMIN_DEFAULT_PASSWORD
    : null;

export const getAdminAuthEnabled = () => {
  return !!ADMIN_AUTH_SECRET && !!ADMIN_DEFAULT_USERNAME && !!ADMIN_DEFAULT_PASSWORD;
};

const timingSafeEqualString = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let ok = 0;
  for (let i = 0; i < a.length; i++) ok |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ok === 0;
};

const utf8 = (s: string) => new TextEncoder().encode(s);

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", utf8(input));
  const bytes = new Uint8Array(digest);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const base64 = btoa(bin);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function ensureDefaultAdmin(): Promise<void> {
  const secret = ADMIN_AUTH_SECRET;
  const username = ADMIN_DEFAULT_USERNAME;
  const password = ADMIN_DEFAULT_PASSWORD;

  if (!secret || !username || !password) {
    console.log("[backend][admin-auth] missing env, default admin not ensured");
    return;
  }

  const key = adminUserKey(username);
  const existing = await storeGet<AdminRecord>(key);
  if (existing) return;

  const passwordHash = await sha256Base64Url(`${secret}:${password}`);

  const rec: AdminRecord = {
    username,
    password: passwordHash,
    role: "admin",
    updatedAt: Date.now(),
  };

  await storeSet(key, rec);
  console.log("[backend][admin-auth] default admin created", { username });
}

export async function verifyAdminPassword(args: {
  username: string;
  password: string;
}): Promise<{ ok: true; user: AdminUser } | { ok: false; error: "INVALID_CREDENTIALS" | "NOT_CONFIGURED" }>
{
  const secret = ADMIN_AUTH_SECRET;
  if (!secret) return { ok: false, error: "NOT_CONFIGURED" };

  await ensureDefaultAdmin();

  const rec = await storeGet<AdminRecord>(adminUserKey(args.username));
  if (!rec) return { ok: false, error: "INVALID_CREDENTIALS" };

  const providedHash = await sha256Base64Url(`${secret}:${args.password}`);
  if (!timingSafeEqualString(providedHash, rec.password)) {
    return { ok: false, error: "INVALID_CREDENTIALS" };
  }

  return { ok: true, user: { username: rec.username, role: rec.role } };
}

export async function createAdminSession(user: AdminUser): Promise<AdminSession> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const token = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

  const now = Date.now();
  const expiresAt = now + 1000 * 60 * 60 * 24 * 7;

  const session: AdminSession = {
    token,
    username: user.username,
    role: user.role,
    createdAt: now,
    expiresAt,
  };

  await storeSet(adminSessionKey(token), session);
  return session;
}

export async function getAdminFromRequest(req: Request): Promise<AdminUser | null> {
  try {
    const raw = req.headers.get("x-admin-auth");
    if (!raw) return null;

    const match = raw.match(/^Bearer\s+(.+)$/i);
    const token = (match?.[1] ?? "").trim();
    if (!token) return null;

    const session = await storeGet<AdminSession>(adminSessionKey(token));
    if (!session) return null;

    if (typeof session.expiresAt !== "number" || Date.now() > session.expiresAt) {
      await storeDelete(adminSessionKey(token));
      return null;
    }

    return { username: session.username, role: session.role };
  } catch (e) {
    console.log("[backend][admin-auth] getAdminFromRequest failed", e);
    return null;
  }
}

export async function deleteAdminSession(token: string): Promise<void> {
  await storeDelete(adminSessionKey(token));
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const { storeListKeys } = await import("@/backend/store");
  const keys = await storeListKeys("admin:user:");
  const users: AdminUser[] = [];

  for (const k of keys) {
    const username = k.replace(/^admin:user:/, "");
    const rec = await storeGet<AdminRecord>(k);
    if (!rec || !username) continue;
    users.push({ username: rec.username ?? username, role: rec.role });
  }

  users.sort((a, b) => a.username.localeCompare(b.username));
  return users;
}

export async function createAdminUser(args: {
  username: string;
  password: string;
  role: AdminRole;
}): Promise<{ ok: true } | { ok: false; error: "ALREADY_EXISTS" | "NOT_CONFIGURED" }> {
  const secret = ADMIN_AUTH_SECRET;
  if (!secret) return { ok: false, error: "NOT_CONFIGURED" };

  const key = adminUserKey(args.username);
  const existing = await storeGet<AdminRecord>(key);
  if (existing) return { ok: false, error: "ALREADY_EXISTS" };

  const passwordHash = await sha256Base64Url(`${secret}:${args.password}`);

  const rec: AdminRecord = {
    username: args.username,
    password: passwordHash,
    role: args.role,
    updatedAt: Date.now(),
  };

  await storeSet(key, rec);
  console.log("[backend][admin-auth] admin user created", {
    username: args.username,
    role: args.role,
  });
  return { ok: true };
}

export async function setAdminUserRole(args: {
  username: string;
  role: AdminRole;
}): Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "NOT_CONFIGURED" }> {
  const secret = ADMIN_AUTH_SECRET;
  if (!secret) return { ok: false, error: "NOT_CONFIGURED" };

  const key = adminUserKey(args.username);
  const rec = await storeGet<AdminRecord>(key);
  if (!rec) return { ok: false, error: "NOT_FOUND" };

  const next: AdminRecord = {
    ...rec,
    role: args.role,
    updatedAt: Date.now(),
  };

  await storeSet(key, next);
  console.log("[backend][admin-auth] admin role updated", {
    username: args.username,
    role: args.role,
  });
  return { ok: true };
}

export async function setAdminUserPassword(args: {
  username: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "NOT_CONFIGURED" }> {
  const secret = ADMIN_AUTH_SECRET;
  if (!secret) return { ok: false, error: "NOT_CONFIGURED" };

  const key = adminUserKey(args.username);
  const rec = await storeGet<AdminRecord>(key);
  if (!rec) return { ok: false, error: "NOT_FOUND" };

  const passwordHash = await sha256Base64Url(`${secret}:${args.newPassword}`);

  const next: AdminRecord = {
    ...rec,
    password: passwordHash,
    updatedAt: Date.now(),
  };

  await storeSet(key, next);
  console.log("[backend][admin-auth] admin password updated", { username: args.username });
  return { ok: true };
}

export async function deleteAdminUser(args: {
  username: string;
}): Promise<{ ok: true } | { ok: false; error: "NOT_FOUND" | "NOT_CONFIGURED" }> {
  const secret = ADMIN_AUTH_SECRET;
  if (!secret) return { ok: false, error: "NOT_CONFIGURED" };

  const key = adminUserKey(args.username);
  const rec = await storeGet<AdminRecord>(key);
  if (!rec) return { ok: false, error: "NOT_FOUND" };

  await storeDelete(key);
  console.log("[backend][admin-auth] admin user deleted", { username: args.username });
  return { ok: true };
}
