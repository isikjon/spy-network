import { serve } from "@hono/node-server";

import { initStore } from "./store";
import { startBackupScheduler } from "./backup";
import app from "./hono";

const portEnv = process.env.PORT;
const port = portEnv ? Number(portEnv) : 3000;

async function main() {
  await initStore();

  // Запуск автоматических бэкапов базы данных
  startBackupScheduler();

  console.log("[backend] starting server", {
    port,
    hasPortEnv: !!portEnv,
    node: process.version,
  });
  serve({
    fetch: app.fetch,
    port,
  });
}

main();
