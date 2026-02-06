import { serveStatic } from "@hono/node-server/serve-static";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { adminApi } from "./admin-api";
import { ADMIN_HTML } from "./admin-page";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { handlePlusofonWebhook } from "./trpc/routes/phone-auth";

const app = new Hono();

app.use("*", cors());

// Вебхук от Plusofon (обратный Flash Call — подтверждение звонка)
app.post("/auth/webhook/plusofon", async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const ok = await handlePlusofonWebhook(body);
    return c.json({ ok });
  } catch (e) {
    console.error("[webhook] plusofon error", e);
    return c.json({ ok: false }, 400);
  }
});

// Клиент шлёт на /api/trpc — путь должен совпадать с endpoint
app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  }),
);

app.route("/", adminApi);

app.get("/admin", (c) => {
  return c.html(ADMIN_HTML);
});

app.get("/api/status", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

// Статика из web/: главная, страницы, форма админки (admin.html)
app.use(
  "*",
  serveStatic({
    root: "web",
    rewriteRequestPath: (path) => (path === "/" ? "/index.html" : path),
  }),
);

export default app;
