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
// Plusofon может слать как JSON, так и form-urlencoded
app.post("/auth/webhook/plusofon", async (c) => {
  try {
    let body: Record<string, unknown>;

    const contentType = c.req.header("content-type") || "";
    console.log("[webhook] plusofon incoming, content-type:", contentType);

    if (contentType.includes("application/json")) {
      body = (await c.req.json()) as Record<string, unknown>;
    } else if (contentType.includes("form-urlencoded")) {
      const formData = await c.req.parseBody();
      body = formData as Record<string, unknown>;
    } else {
      // Попробуем оба варианта
      const rawText = await c.req.text();
      console.log("[webhook] plusofon raw body:", rawText);
      try {
        body = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        // Парсим как query string: key=value&key2=value2
        const params = new URLSearchParams(rawText);
        body = {};
        for (const [k, v] of params.entries()) {
          body[k] = v;
        }
      }
    }

    console.log("[webhook] plusofon parsed body:", JSON.stringify(body));
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
