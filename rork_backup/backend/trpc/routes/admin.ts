import * as z from "zod";

import { storeGet, storeListKeys } from "@/backend/store";
import { createTRPCRouter, publicProcedure } from "../create-context";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  setAdminUserPassword,
  setAdminUserRole,
  type AdminRole,
} from "../utils/admin-auth";

type UserAppData = {
  phoneNumber: string;
  dossiers: unknown[];
  sectors: string[];
  powerGroupings: string[];
  updatedAt: number;
};

type ContactLite = {
  id: string;
  name: string;
  phoneNumbers: string[];
  emails: string[];
  ownerPhoneNumber: string;
  groupName: string | null;
  suzerainId: string | null;
  vassalIds: string[];
};

type PowerEdge = {
  suzerainId: string;
  vassalId: string;
  groupName: string;
};

const normalizePhone = (v: string) => v.replace(/\D+/g, "");

const contactFromDossier = (ownerPhoneNumber: string, d: unknown): ContactLite | null => {
  const c = (d as any)?.contact;
  const pg = (d as any)?.powerGrouping;

  const id = typeof c?.id === "string" ? c.id : "";
  if (!id) return null;

  const name = typeof c?.name === "string" ? c.name : "";

  const phoneNumbers = Array.isArray(c?.phoneNumbers)
    ? (c.phoneNumbers as unknown[]).map((x) => String(x)).filter(Boolean)
    : ([] as string[]);

  const emails = Array.isArray(c?.emails)
    ? (c.emails as unknown[]).map((x) => String(x)).filter(Boolean)
    : ([] as string[]);

  const groupName = typeof pg?.groupName === "string" && pg.groupName.trim().length > 0 ? pg.groupName.trim() : null;
  const suzerainId = typeof pg?.suzerainId === "string" && pg.suzerainId.trim().length > 0 ? pg.suzerainId.trim() : null;
  const vassalIds = Array.isArray(pg?.vassalIds)
    ? (pg.vassalIds as unknown[]).map((x) => String(x)).filter(Boolean)
    : ([] as string[]);

  return {
    id,
    name,
    phoneNumbers,
    emails,
    ownerPhoneNumber,
    groupName,
    suzerainId,
    vassalIds,
  };
};

const isAdminRequest = (ctx: {
  adminUser?: { username: string; role: string } | null;
}) => {
  return !!ctx.adminUser;
};

const requireAdminRole = (
  ctx: { adminUser?: { username: string; role: string } | null },
  roles: string[],
) => {
  const role = ctx.adminUser?.role;
  if (!role) return false;
  return roles.includes(role);
};

const userKeyToPhone = (key: string) => {
  const parts = key.split(":");
  if (parts.length < 3) return null;
  if (parts[0] !== "user") return null;
  if (parts[2] !== "data") return null;
  return parts[1] || null;
};

const adminGuard = (ctx: {
  adminUser?: { username: string; role: string } | null;
}) => {
  if (!isAdminRequest(ctx)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  return null;
};

export const adminRouter = createTRPCRouter({
  adminList: publicProcedure.query(async ({ ctx }) => {
    console.log("[backend] admin.adminList", { admin: ctx.adminUser?.username });

    const guard = adminGuard(ctx);
    if (guard) return guard;

    if (!requireAdminRole(ctx, ["admin", "manager"])) {
      return { ok: false as const, error: "FORBIDDEN" as const };
    }

    const admins = await listAdminUsers();
    return { ok: true as const, admins };
  }),

  adminCreate: publicProcedure
    .input(
      z.object({
        username: z.string().min(3).max(64),
        password: z.string().min(6).max(200),
        role: z.union([z.literal("admin"), z.literal("manager"), z.literal("analyst")]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[backend] admin.adminCreate", {
        admin: ctx.adminUser?.username,
        username: input.username,
        role: input.role,
      });

      const guard = adminGuard(ctx);
      if (guard) return guard;

      if (!requireAdminRole(ctx, ["admin", "manager"])) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const res = await createAdminUser({
        username: input.username,
        password: input.password,
        role: input.role as AdminRole,
      });

      if (!res.ok) return { ok: false as const, error: res.error };
      return { ok: true as const };
    }),

  adminSetPassword: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        newPassword: z.string().min(6).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[backend] admin.adminSetPassword", {
        admin: ctx.adminUser?.username,
        username: input.username,
      });

      const guard = adminGuard(ctx);
      if (guard) return guard;

      if (!requireAdminRole(ctx, ["admin", "manager"])) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const res = await setAdminUserPassword({
        username: input.username,
        newPassword: input.newPassword,
      });

      if (!res.ok) return { ok: false as const, error: res.error };
      return { ok: true as const };
    }),

  adminSetRole: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        role: z.union([z.literal("admin"), z.literal("manager"), z.literal("analyst")]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log("[backend] admin.adminSetRole", {
        admin: ctx.adminUser?.username,
        username: input.username,
        role: input.role,
      });

      const guard = adminGuard(ctx);
      if (guard) return guard;

      if (!requireAdminRole(ctx, ["admin", "manager"])) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const res = await setAdminUserRole({
        username: input.username,
        role: input.role as AdminRole,
      });

      if (!res.ok) return { ok: false as const, error: res.error };
      return { ok: true as const };
    }),

  adminDelete: publicProcedure
    .input(z.object({ username: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      console.log("[backend] admin.adminDelete", {
        admin: ctx.adminUser?.username,
        username: input.username,
      });

      const guard = adminGuard(ctx);
      if (guard) return guard;

      if (!requireAdminRole(ctx, ["admin"])) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      if (ctx.adminUser?.username === input.username) {
        return { ok: false as const, error: "CANNOT_DELETE_SELF" as const };
      }

      const res = await deleteAdminUser({ username: input.username });
      if (!res.ok) return { ok: false as const, error: res.error };
      return { ok: true as const };
    }),

  analyticsUsersList: publicProcedure
    .input(
      z
        .object({
          query: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(200),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      console.log("[backend] admin.analyticsUsersList", {
        query: input?.query,
        limit: input?.limit,
      });

      if (!isAdminRequest(ctx) || !requireAdminRole(ctx, ["admin", "analyst"])) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const query = (input?.query ?? "").trim();
      const keys = await storeListKeys("user:");
      const dataKeys = keys.filter((k) => k.endsWith(":data"));

      const phones = dataKeys
        .map((k) => userKeyToPhone(k))
        .filter((p): p is string => typeof p === "string" && p.length > 0)
        .filter((p) => (query.length > 0 ? p.includes(query) : true))
        .slice(0, input?.limit ?? 200);

      const users: {
        phoneNumber: string;
        dossiersCount: number;
        updatedAt: number;
      }[] = [];

      for (const phone of phones) {
        const stored = await storeGet<UserAppData>(`user:${phone}:data`);
        if (!stored) continue;
        users.push({
          phoneNumber: stored.phoneNumber || phone,
          dossiersCount: Array.isArray(stored.dossiers) ? stored.dossiers.length : 0,
          updatedAt: typeof stored.updatedAt === "number" ? stored.updatedAt : 0,
        });
      }

      users.sort((a, b) => b.updatedAt - a.updatedAt);

      return {
        ok: true as const,
        query,
        users,
      };
    }),

  analyticsUserDossier: publicProcedure
    .input(z.object({ phoneNumber: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      console.log("[backend] admin.analyticsUserDossier", {
        phoneNumber: input.phoneNumber,
      });

      if (!isAdminRequest(ctx) || !requireAdminRole(ctx, ["admin", "analyst"])) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const stored = await storeGet<UserAppData>(`user:${input.phoneNumber}:data`);
      if (!stored) return { ok: false as const, error: "NOT_FOUND" as const };

      const dossiers = Array.isArray(stored.dossiers) ? stored.dossiers : [];

      const contacts = dossiers
        .map((d) => {
          const c = (d as any)?.contact;
          const rels = (d as any)?.relations;
          return {
            id: String(c?.id ?? ""),
            name: String(c?.name ?? ""),
            phoneNumbers: Array.isArray(c?.phoneNumbers)
              ? (c.phoneNumbers as unknown[]).map((x) => String(x))
              : ([] as string[]),
            emails: Array.isArray(c?.emails)
              ? (c.emails as unknown[]).map((x) => String(x))
              : ([] as string[]),
            importance: String((d as any)?.importance ?? ""),
            functionalCircle: String((d as any)?.functionalCircle ?? ""),
            relationsCount: Array.isArray(rels) ? rels.length : 0,
          };
        })
        .filter((c) => c.id.length > 0 || c.name.length > 0);

      return { ok: true as const, phoneNumber: stored.phoneNumber, contacts };
    }),

  analyticsUserNetworkMap: publicProcedure
    .input(z.object({ phoneNumber: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      console.log("[backend] admin.analyticsUserNetworkMap", {
        phoneNumber: input.phoneNumber,
      });

      if (!isAdminRequest(ctx) || !requireAdminRole(ctx, ["admin", "analyst"])) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const stored = await storeGet<UserAppData>(`user:${input.phoneNumber}:data`);
      if (!stored) return { ok: false as const, error: "NOT_FOUND" as const };

      const dossiers = Array.isArray(stored.dossiers) ? stored.dossiers : [];

      const nodes = new Map<string, { id: string; name: string }>();
      const edges = new Map<string, Set<string>>();

      const addEdge = (a: string, b: string) => {
        if (!edges.has(a)) edges.set(a, new Set());
        edges.get(a)?.add(b);
      };

      for (const d of dossiers) {
        const c = (d as any)?.contact;
        const rels = (d as any)?.relations;
        const id = typeof c?.id === "string" ? c.id : null;
        const name = typeof c?.name === "string" ? c.name : "";
        if (!id) continue;

        nodes.set(id, { id, name });

        if (!Array.isArray(rels)) continue;
        for (const r of rels) {
          const other = (r as any)?.contactId;
          if (typeof other !== "string" || other.length === 0) continue;
          addEdge(id, other);
          addEdge(other, id);
        }
      }

      let edgesCount = 0;
      for (const set of edges.values()) edgesCount += set.size;

      const degrees: { id: string; degree: number; name: string }[] = [];
      for (const [id, set] of edges.entries()) {
        degrees.push({ id, degree: set.size, name: nodes.get(id)?.name ?? "" });
      }
      degrees.sort((a, b) => b.degree - a.degree);

      return {
        ok: true as const,
        summary: {
          nodes: nodes.size,
          edges: edgesCount,
          top: degrees.slice(0, 15),
        },
      };
    }),

  analyticsUserProfile: publicProcedure
    .input(z.object({ phoneNumber: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      console.log("[backend] admin.analyticsUserProfile", {
        phoneNumber: input.phoneNumber,
      });

      if (!isAdminRequest(ctx) || !requireAdminRole(ctx, ["admin", "analyst"])) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const stored = await storeGet<UserAppData>(`user:${input.phoneNumber}:data`);
      if (!stored) return { ok: false as const, error: "NOT_FOUND" as const };

      return {
        ok: true as const,
        phoneNumber: stored.phoneNumber,
        updatedAt: stored.updatedAt,
        dossiersCount: Array.isArray(stored.dossiers) ? stored.dossiers.length : 0,
        sectors: Array.isArray(stored.sectors) ? stored.sectors : [],
        powerGroupings: Array.isArray(stored.powerGroupings) ? stored.powerGroupings : [],
      };
    }),

  analyticsContactsSearch: publicProcedure
    .input(
      z
        .object({
          phoneQuery: z.string().optional(),
          onlyPowerGroupings: z.boolean().optional(),
          limit: z.number().int().min(1).max(500).default(120),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      console.log("[backend] admin.analyticsContactsSearch", input);

      if (!isAdminRequest(ctx) || !requireAdminRole(ctx, ["admin", "analyst"])) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const phoneQueryRaw = (input?.phoneQuery ?? "").trim();
      const phoneQuery = normalizePhone(phoneQueryRaw);
      const onlyPowerGroupings = input?.onlyPowerGroupings ?? false;

      const keys = await storeListKeys("user:");
      const dataKeys = keys.filter((k) => k.endsWith(":data"));

      const contactsMap = new Map<string, ContactLite>();

      for (const k of dataKeys) {
        const phone = userKeyToPhone(k);
        if (!phone) continue;

        const stored = await storeGet<UserAppData>(k);
        if (!stored || !Array.isArray(stored.dossiers)) continue;

        for (const d of stored.dossiers) {
          const c = contactFromDossier(phone, d);
          if (!c) continue;

          if (onlyPowerGroupings && !c.groupName) continue;

          if (phoneQuery.length > 0) {
            const anyMatch = c.phoneNumbers.some((p) => normalizePhone(p).includes(phoneQuery));
            if (!anyMatch) continue;
          }

          if (!contactsMap.has(c.id)) {
            contactsMap.set(c.id, c);
          }
        }
      }

      const limit = input?.limit ?? 120;
      const contacts = Array.from(contactsMap.values()).slice(0, limit);

      return { ok: true as const, contacts };
    }),

  analyticsPowerGroupingsRelated: publicProcedure
    .input(z.object({ contactId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      console.log("[backend] admin.analyticsPowerGroupingsRelated", input);

      if (!isAdminRequest(ctx) || !requireAdminRole(ctx, ["admin", "analyst"])) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const keys = await storeListKeys("user:");
      const dataKeys = keys.filter((k) => k.endsWith(":data"));

      const allPowerContactsById = new Map<string, ContactLite>();

      for (const k of dataKeys) {
        const phone = userKeyToPhone(k);
        if (!phone) continue;

        const stored = await storeGet<UserAppData>(k);
        if (!stored || !Array.isArray(stored.dossiers)) continue;

        for (const d of stored.dossiers) {
          const c = contactFromDossier(phone, d);
          if (!c) continue;
          if (!c.groupName) continue;
          if (!allPowerContactsById.has(c.id)) allPowerContactsById.set(c.id, c);
        }
      }

      const selected = allPowerContactsById.get(input.contactId);
      if (!selected) return { ok: false as const, error: "NOT_FOUND" as const };

      if (!selected.groupName) {
        return { ok: false as const, error: "NO_GROUP" as const };
      }

      const groupName = selected.groupName;
      const sameGroup = Array.from(allPowerContactsById.values()).filter((c) => c.groupName === groupName);

      const edges: PowerEdge[] = [];

      const addEdge = (s: string, v: string) => {
        if (!s || !v) return;
        if (s === v) return;
        edges.push({ suzerainId: s, vassalId: v, groupName });
      };

      for (const c of sameGroup) {
        for (const v of c.vassalIds) {
          addEdge(c.id, v);
        }
        if (c.suzerainId) {
          addEdge(c.suzerainId, c.id);
        }
      }

      const relatedIds = new Set<string>();
      relatedIds.add(selected.id);

      for (const e of edges) {
        if (e.suzerainId === selected.id || e.vassalId === selected.id) {
          relatedIds.add(e.suzerainId);
          relatedIds.add(e.vassalId);
        }
      }

      const relatedContacts = Array.from(relatedIds)
        .map((id) => allPowerContactsById.get(id))
        .filter((x): x is ContactLite => !!x);

      const filteredEdges = edges.filter((e) => relatedIds.has(e.suzerainId) && relatedIds.has(e.vassalId));

      return {
        ok: true as const,
        groupName,
        selected,
        relatedContacts,
        edges: filteredEdges,
      };
    }),

  analyticsSixHandshakes: publicProcedure
    .input(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        maxDepth: z.number().int().min(1).max(6).default(6),
      }),
    )
    .query(async ({ ctx, input }) => {
      console.log("[backend] admin.analyticsSixHandshakes", input);

      if (!isAdminRequest(ctx) || !requireAdminRole(ctx, ["admin", "analyst"])) {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }

      const keys = await storeListKeys("user:");
      const dataKeys = keys.filter((k) => k.endsWith(":data"));

      const edges: Map<string, Set<string>> = new Map();
      const contactsById = new Map<string, { id: string; name: string; phoneNumbers: string[]; ownerPhoneNumber: string }>();

      const addEdge = (a: string, b: string) => {
        if (!edges.has(a)) edges.set(a, new Set());
        edges.get(a)?.add(b);
      };

      for (const k of dataKeys) {
        const ownerPhone = userKeyToPhone(k) ?? "";
        const stored = await storeGet<UserAppData>(k);
        if (!stored || !Array.isArray(stored.dossiers)) continue;

        for (const d of stored.dossiers) {
          const rels = (d as any)?.relations;
          const c = (d as any)?.contact;
          const id = typeof c?.id === "string" ? c.id : null;
          if (!id) continue;

          if (!contactsById.has(id)) {
            const name = typeof c?.name === "string" ? c.name : "";
            const phoneNumbers = Array.isArray(c?.phoneNumbers)
              ? (c.phoneNumbers as unknown[]).map((x) => String(x)).filter(Boolean)
              : ([] as string[]);
            contactsById.set(id, { id, name, phoneNumbers, ownerPhoneNumber: ownerPhone });
          }

          if (!Array.isArray(rels)) continue;

          for (const r of rels) {
            const other = (r as any)?.contactId;
            if (typeof other === "string" && other.length > 0) {
              addEdge(id, other);
              addEdge(other, id);
            }
          }
        }
      }

      const from = input.from;
      const to = input.to;

      if (from === to) {
        const single = contactsById.get(from) ?? { id: from, name: "", phoneNumbers: [], ownerPhoneNumber: "" };
        return { ok: true as const, path: [from], depth: 0, pathContacts: [single] };
      }

      const q: { node: string; path: string[] }[] = [{ node: from, path: [from] }];
      const visited = new Set<string>([from]);

      while (q.length > 0) {
        const cur = q.shift();
        if (!cur) break;

        if (cur.path.length - 1 >= input.maxDepth) continue;

        const neighbors = Array.from(edges.get(cur.node) ?? []);
        for (const n of neighbors) {
          if (visited.has(n)) continue;
          const nextPath = [...cur.path, n];
          if (n === to) {
            const pathContacts = nextPath.map((id) => contactsById.get(id) ?? { id, name: "", phoneNumbers: [], ownerPhoneNumber: "" });
            return { ok: true as const, path: nextPath, depth: nextPath.length - 1, pathContacts };
          }
          visited.add(n);
          q.push({ node: n, path: nextPath });
        }
      }

      return { ok: true as const, path: null, depth: null, pathContacts: null };
    }),

  analyticsPowerGroupings: publicProcedure.query(async ({ ctx }) => {
    console.log("[backend] admin.analyticsPowerGroupings");

    if (!isAdminRequest(ctx) || !requireAdminRole(ctx, ["admin", "analyst"])) {
      return { ok: false as const, error: "FORBIDDEN" as const };
    }

    const keys = await storeListKeys("user:");
    const dataKeys = keys.filter((k) => k.endsWith(":data"));

    const counts: Record<string, number> = {};

    for (const k of dataKeys) {
      const stored = await storeGet<UserAppData>(k);
      if (!stored || !Array.isArray(stored.dossiers)) continue;

      for (const d of stored.dossiers) {
        const groupName = (d as any)?.powerGrouping?.groupName;
        if (typeof groupName === "string" && groupName.trim()) {
          counts[groupName.trim()] = (counts[groupName.trim()] ?? 0) + 1;
        }
      }
    }

    const groups = Object.entries(counts)
      .map(([groupName, dossiersCount]) => ({ groupName, dossiersCount }))
      .sort((a, b) => b.dossiersCount - a.dossiersCount);

    return { ok: true as const, groups };
  }),
});
