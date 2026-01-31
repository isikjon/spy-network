import { initTRPC } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";

import { getAdminFromRequest } from "./utils/admin-auth";

export const createContext = async (opts: FetchCreateContextFnOptions) => {
  console.log("[backend] createContext", {
    url: opts.req.url,
    method: opts.req.method,
  });

  const userPhone = opts.req.headers.get("x-user-phone") || null;

  const adminUser = await getAdminFromRequest(opts.req);

  return {
    req: opts.req,
    userPhone,
    adminUser,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

export type AdminRole = "admin" | "analyst" | "manager";
export type AdminUser = {
  username: string;
  role: AdminRole;
};


const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
