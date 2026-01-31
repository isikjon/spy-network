import { serve } from "@hono/node-server";

import app from "./hono";

const portEnv = process.env.PORT;
const port = portEnv ? Number(portEnv) : 3000;

console.log("[backend] starting server", {
  port,
  hasPortEnv: !!portEnv,
  node: process.version,
});

serve({
  fetch: app.fetch,
  port,
});
