import { serveStatic } from "@hono/node-server/serve-static";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { adminApi } from "./admin-api";
import { ADMIN_HTML } from "./admin-page";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { handlePlusofonWebhook } from "./trpc/routes/phone-auth";
import { handleYooKassaWebhook } from "./trpc/routes/payment";

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

// Webhook от YooKassa — подтверждение оплаты
app.post("/payment/webhook/yookassa", async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    console.log("[webhook] yookassa incoming", JSON.stringify(body));
    const ok = await handleYooKassaWebhook(body);
    return c.json({ ok });
  } catch (e) {
    console.error("[webhook] yookassa error", e);
    return c.json({ ok: false }, 400);
  }
});

// Страница успешной оплаты (редирект после YooKassa)
app.get("/payment/success", (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Оплата прошла успешно — Spy Network</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; color: #00FF41; font-family: monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .box { text-align: center; padding: 40px; border: 2px solid #003311; max-width: 480px; }
    h1 { font-size: 28px; letter-spacing: 4px; margin-bottom: 16px; }
    p { color: #00AA2B; font-size: 14px; letter-spacing: 1px; line-height: 1.6; margin-bottom: 24px; }
    a { display: inline-block; border: 2px solid #00FF41; padding: 12px 32px; color: #00FF41; text-decoration: none; letter-spacing: 2px; font-size: 14px; }
    a:hover { background: rgba(0,255,65,0.1); }
  </style>
</head>
<body>
  <div class="box">
    <div style="font-size:48px;margin-bottom:20px">✓</div>
    <h1>ДОПУСК ПОЛУЧЕН</h1>
    <p>Оплата прошла успешно.<br>Уровень 2 активирован на 7 дней.<br>Вернитесь в приложение — обновление произойдёт автоматически.</p>
    <a href="/">← ВЕРНУТЬСЯ</a>
  </div>
</body>
</html>`);
});

// Expo web app — JS/CSS бандлы и ассеты (по корню, не под /app)
app.use("/_expo/*", serveStatic({ root: "dist" }));
app.use("/assets/*", serveStatic({ root: "dist" }));
app.get("/favicon.ico", serveStatic({ root: "dist", path: "/favicon.ico" }));

// SPA: /app и /app/* (в т.ч. /app/auth) — всегда index.html, иначе был 404 на /app/auth
const serveAppHtml = async (c: { html: (body: string) => Response; text: (body: string, status?: number) => Response }) => {
  const fs = await import("node:fs/promises");
  try {
    const html = await fs.readFile("dist/index.html", "utf-8");
    return c.html(html);
  } catch {
    return c.text("App not built. Run: npx expo export --platform web", 404);
  }
};
app.get("/app", serveAppHtml);
app.get("/app/*", serveAppHtml);

// Статика приложения под /app (бандлы Expo под /app/_expo, /app/assets — если в dist так)
app.use(
  "/app/_expo/*",
  serveStatic({ root: "dist", rewriteRequestPath: (path) => path.replace(/^\/app/, "") }),
);
app.use(
  "/app/assets/*",
  serveStatic({ root: "dist", rewriteRequestPath: (path) => path.replace(/^\/app/, "") }),
);

// Статика из web/: главная, страницы, форма админки (admin.html)
app.use(
  "*",
  serveStatic({
    root: "web",
    rewriteRequestPath: (path) => (path === "/" ? "/index.html" : path),
  }),
);

export default app;
