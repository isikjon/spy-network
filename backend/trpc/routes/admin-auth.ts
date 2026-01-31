import * as z from "zod";

import { createTRPCRouter, publicProcedure } from "../create-context";
import {
  createAdminSession,
  deleteAdminSession,
  ensureDefaultAdmin,
  getAdminAuthEnabled,
  verifyAdminPassword,
} from "../utils/admin-auth";

const parseBearer = (raw: string | null) => {
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  const token = (match?.[1] ?? "").trim();
  return token.length > 0 ? token : null;
};

export const adminAuthRouter = createTRPCRouter({
  status: publicProcedure.query(async () => {
    console.log("[backend] adminAuth.status");
    return {
      ok: true as const,
      enabled: getAdminAuthEnabled(),
    };
  }),

  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      console.log("[backend] adminAuth.login", { username: input.username });

      if (!getAdminAuthEnabled()) {
        return { ok: false as const, error: "NOT_CONFIGURED" as const };
      }

      await ensureDefaultAdmin();

      const res = await verifyAdminPassword({
        username: input.username,
        password: input.password,
      });

      if (!res.ok) {
        return { ok: false as const, error: res.error };
      }

      const session = await createAdminSession(res.user);
      return {
        ok: true as const,
        token: session.token,
        role: session.role,
        expiresAt: session.expiresAt,
      };
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    console.log("[backend] adminAuth.logout");

    const raw = ctx.req.headers.get("x-admin-auth");
    const token = parseBearer(raw);
    if (token) {
      await deleteAdminSession(token);
    }

    return { ok: true as const };
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    console.log("[backend] adminAuth.me", { admin: ctx.adminUser?.username });

    if (!ctx.adminUser) {
      return { ok: false as const, error: "UNAUTHENTICATED" as const };
    }

    return { ok: true as const, user: ctx.adminUser };
  }),
});
