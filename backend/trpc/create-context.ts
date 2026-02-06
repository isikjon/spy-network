import { initTRPC } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";

import { getAdminFromRequest } from "./utils/admin-auth";
import { getUserPhoneFromRequest } from "./utils/user-session";

export const createContext = async (opts: FetchCreateContextFnOptions) => {
  console.log("[backend] createContext", {
    url: opts.req.url,
    method: opts.req.method,
  });

  // Получаем телефон: сначала из токена сессии (x-user-auth), потом из x-user-phone
  const userPhone = await getUserPhoneFromRequest(opts.req);

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
