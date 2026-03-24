import { Hono } from "hono";
import { storeGet, storeListKeys } from "./store";
import {
  createAdminSession,
  getAdminFromRequest,
  getAdminAuthEnabled,
  verifyAdminPassword,
} from "./trpc/utils/admin-auth";
import { createBackup } from "./backup";
import { getUserLevel } from "./trpc/utils/user-level";
import type { SavedCard } from "./trpc/routes/payment";

type UserAppData = {
  phoneNumber: string;
  dossiers: unknown[];
  sectors: string[];
  powerGroupings: string[];
  updatedAt: number;
};

type AdminUserRow = {
  phoneNumber: string;
  dossiersCount: number;
  updatedAt: number;
  level: number;
  subscriptionStatus: "none" | "active" | "expired" | "cancelled";
  paymentStatus: "none" | "paid" | "unpaid" | "cancelled";
  hasCard: boolean;
  nextChargeAt: number | null;
  accessUntil: number | null;
};

const userKeyToPhone = (key: string): string | null => {
  const parts = key.split(":");
  if (parts.length < 3) return null;
  if (parts[0] !== "user") return null;
  if (parts[2] !== "data") return null;
  return parts[1] || null;
};

const maskPhone = (phone: string): string => {
  const digits = (phone || "").replace(/\D+/g, "");
  if (digits.length <= 6) return "***";
  return digits.slice(0, 4) + "***" + digits.slice(-4);
};

export const adminApi = new Hono();

adminApi.post("/admin-api/login", async (c) => {
  if (!getAdminAuthEnabled()) {
    return c.json({ ok: false, error: "NOT_CONFIGURED" }, 400);
  }
  let body: { username?: string; password?: string };
  try {
    body = (await c.req.json()) as { username?: string; password?: string };
  } catch {
    return c.json({ ok: false, error: "INVALID_BODY" }, 400);
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return c.json({ ok: false, error: "MISSING_CREDENTIALS" }, 400);
  }
  const res = await verifyAdminPassword({ username, password });
  if (!res.ok) {
    const err = (res as { ok: false; error: "INVALID_CREDENTIALS" | "NOT_CONFIGURED" }).error;
    return c.json({ ok: false, error: err }, 401);
  }
  const session = await createAdminSession(res.user);
  return c.json({
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: { username: res.user.username, role: res.user.role },
  });
});

adminApi.get("/admin-api/me", async (c) => {
  const user = await getAdminFromRequest(c.req.raw);
  if (!user) {
    return c.json({ ok: false, error: "UNAUTHENTICATED" }, 401);
  }
  return c.json({ ok: true, user });
});

adminApi.get("/admin-api/users", async (c) => {
  const user = await getAdminFromRequest(c.req.raw);
  if (!user) {
    return c.json({ ok: false, error: "UNAUTHENTICATED" }, 401);
  }
  const role = user.role;
  if (role !== "admin" && role !== "analyst" && role !== "manager") {
    return c.json({ ok: false, error: "FORBIDDEN" }, 403);
  }

  const query = c.req.query("query") ?? "";
  const limit = Math.min(500, Math.max(1, parseInt(c.req.query("limit") ?? "200", 10) || 200));

  const keys = await storeListKeys("user:");
  const dataKeys = keys.filter((k) => k.endsWith(":data"));
  const phones = dataKeys
    .map((k) => userKeyToPhone(k))
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .filter((p) => (query.length > 0 ? p.includes(query) : true))
    .slice(0, limit);

  const users: AdminUserRow[] = [];
  for (const phone of phones) {
    const stored = await storeGet<UserAppData>(`user:${phone}:data`);
    if (!stored) continue;
    const levelData = await getUserLevel(phone);
    const card = await storeGet<SavedCard>(`user:${phone}:payment_method`);
    const hasCard = !!card?.paymentMethodId;
    const now = Date.now();
    const accessUntil =
      typeof levelData.subscribedUntil === "number" && levelData.subscribedUntil > 0
        ? levelData.subscribedUntil
        : null;
    const isActive = levelData.level >= 2 && !!accessUntil && accessUntil > now;
    const isExpired = !!accessUntil && accessUntil <= now;
    const isCancelled = isActive && !hasCard;

    const subscriptionStatus: AdminUserRow["subscriptionStatus"] =
      isCancelled ? "cancelled" : isActive ? "active" : isExpired ? "expired" : "none";

    const paymentStatus: AdminUserRow["paymentStatus"] =
      !accessUntil ? "none" : isCancelled ? "cancelled" : isActive ? "paid" : "unpaid";

    users.push({
      phoneNumber: maskPhone(stored.phoneNumber || phone),
      dossiersCount: Array.isArray(stored.dossiers) ? stored.dossiers.length : 0,
      updatedAt: typeof stored.updatedAt === "number" ? stored.updatedAt : 0,
      level: levelData.level,
      subscriptionStatus,
      paymentStatus,
      hasCard,
      nextChargeAt: isActive ? accessUntil : null,
      accessUntil,
    });
  }
  users.sort((a, b) => b.updatedAt - a.updatedAt);
  return c.json({ ok: true, users, query });
});

adminApi.get("/admin-api/analytics/overview", async (c) => {
  const user = await getAdminFromRequest(c.req.raw);
  if (!user) {
    return c.json({ ok: false, error: "UNAUTHENTICATED" }, 401);
  }
  if (user.role !== "admin" && user.role !== "analyst" && user.role !== "manager") {
    return c.json({ ok: false, error: "FORBIDDEN" }, 403);
  }

  const keys = await storeListKeys("user:");
  const dataKeys = keys.filter((k) => k.endsWith(":data"));
  const phones = dataKeys
    .map((k) => userKeyToPhone(k))
    .filter((p): p is string => typeof p === "string" && p.length > 0);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day0 = startOfToday.getTime();

  const activeUsersByDay: number[] = Array.from({ length: 7 }, () => 0);
  const paidUsersByDay: number[] = Array.from({ length: 7 }, () => 0);

  let totalUsers = 0;
  let level1Users = 0;
  let level2Users = 0;
  let subscriptionActive = 0;
  let subscriptionExpired = 0;
  let subscriptionCancelled = 0;
  let paymentPaid = 0;
  let paymentUnpaid = 0;

  for (const phone of phones) {
    const stored = await storeGet<UserAppData>(`user:${phone}:data`);
    if (!stored) continue;

    totalUsers += 1;

    const levelData = await getUserLevel(phone);
    const card = await storeGet<SavedCard>(`user:${phone}:payment_method`);
    const hasCard = !!card?.paymentMethodId;
    const accessUntil =
      typeof levelData.subscribedUntil === "number" && levelData.subscribedUntil > 0
        ? levelData.subscribedUntil
        : null;
    const isActive = levelData.level >= 2 && !!accessUntil && accessUntil > now;
    const isExpired = !!accessUntil && accessUntil <= now;
    const isCancelled = isActive && !hasCard;

    if (levelData.level >= 2) level2Users += 1;
    else level1Users += 1;

    if (isCancelled) subscriptionCancelled += 1;
    else if (isActive) subscriptionActive += 1;
    if (isExpired) subscriptionExpired += 1;

    if (!accessUntil) { /* no subscription — skip payment counter */ }
    else if (isActive) paymentPaid += 1;
    else paymentUnpaid += 1;

    for (let i = 0; i < 7; i++) {
      const dayStart = day0 - (6 - i) * dayMs;
      const dayEnd = dayStart + dayMs - 1;
      const wasUpdatedThisDay =
        typeof stored.updatedAt === "number" &&
        stored.updatedAt >= dayStart &&
        stored.updatedAt <= dayEnd;
      if (wasUpdatedThisDay) {
        activeUsersByDay[i] += 1;
      }
      if (accessUntil && accessUntil >= dayStart && accessUntil <= dayEnd) {
        paidUsersByDay[i] += 1;
      }
    }
  }

  const labels = Array.from({ length: 7 }).map((_, i) => {
    const ts = day0 - (6 - i) * dayMs;
    return new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  });

  return c.json({
    ok: true,
    totals: {
      totalUsers,
      level1Users,
      level2Users,
      subscriptionActive,
      subscriptionExpired,
      subscriptionCancelled,
      paymentPaid,
      paymentUnpaid,
    },
    charts: {
      labels,
      activeUsersByDay,
      paidUsersByDay,
    },
  });
});

adminApi.get("/admin-api/users/:phone", async (c) => {
  const user = await getAdminFromRequest(c.req.raw);
  if (!user) {
    return c.json({ ok: false, error: "UNAUTHENTICATED" }, 401);
  }
  if (user.role !== "admin" && user.role !== "analyst") {
    return c.json({ ok: false, error: "FORBIDDEN" }, 403);
  }
  const phone = c.req.param("phone");
  if (!phone) {
    return c.json({ ok: false, error: "MISSING_PHONE" }, 400);
  }
  const stored = await storeGet<UserAppData>(`user:${phone}:data`);
  if (!stored) {
    return c.json({ ok: false, error: "NOT_FOUND" }, 404);
  }
  const dossiers = Array.isArray(stored.dossiers) ? stored.dossiers : [];
  // Безопасность: админы видят только агрегированные данные
  const contacts = dossiers.map((d: unknown) => {
    const doc = d as Record<string, unknown>;
    const c = (doc?.contact as Record<string, unknown>) ?? {};
    const rels = (doc?.relations as unknown[]) ?? [];
    return {
      id: String(c?.id ?? ""),
      importance: String((doc?.importance as string) ?? ""),
      functionalCircle: String((doc?.functionalCircle as string) ?? ""),
      relationsCount: rels.length,
    };
  });
  return c.json({
    ok: true,
    phoneNumber: maskPhone(stored.phoneNumber),
    updatedAt: stored.updatedAt,
    dossiersCount: dossiers.length,
    sectors: Array.isArray(stored.sectors) ? stored.sectors : [],
    powerGroupings: Array.isArray(stored.powerGroupings) ? stored.powerGroupings : [],
    contacts,
  });
});

// Ручной бэкап базы данных (только для админов)
adminApi.post("/admin-api/backup", async (c) => {
  const user = await getAdminFromRequest(c.req.raw);
  if (!user) {
    return c.json({ ok: false, error: "UNAUTHENTICATED" }, 401);
  }
  if (user.role !== "admin") {
    return c.json({ ok: false, error: "FORBIDDEN" }, 403);
  }
  try {
    await createBackup();
    return c.json({ ok: true, message: "Backup created" });
  } catch (e) {
    return c.json({ ok: false, error: "BACKUP_FAILED" }, 500);
  }
});
