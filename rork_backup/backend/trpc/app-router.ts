import { createTRPCRouter } from "./create-context";
import { adminRouter } from "./routes/admin";
import { adminAuthRouter } from "./routes/admin-auth";
import { appDataRouter } from "./routes/app-data";
import { exampleRouter } from "./routes/example";
import { qrAuthRouter } from "./routes/qr-auth";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  appData: appDataRouter,
  admin: adminRouter,
  adminAuth: adminAuthRouter,
  qrAuth: qrAuthRouter,
});

export type AppRouter = typeof appRouter;
