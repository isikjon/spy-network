import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import Constants from "expo-constants";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const DEFAULT_API_BASE_URL = "https://spynetwork.ru";

const getBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (fromEnv && typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim();
  }
  const fromExtra = Constants.expoConfig?.extra?.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    return fromExtra.trim();
  }
  return DEFAULT_API_BASE_URL;
};

const USER_PHONE_STORAGE_KEY = "user_phone" as const;
const USER_SESSION_TOKEN_KEY = "user_session_token" as const;
const ADMIN_TOKEN_STORAGE_KEY = "admin_auth_token" as const;

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      headers: async () => {
        try {
          const [phone, sessionToken, adminToken] = await Promise.all([
            AsyncStorage.getItem(USER_PHONE_STORAGE_KEY),
            AsyncStorage.getItem(USER_SESSION_TOKEN_KEY),
            AsyncStorage.getItem(ADMIN_TOKEN_STORAGE_KEY),
          ]);

          const headers: Record<string, string> = {};
          // Токен сессии (верифицированный) имеет приоритет
          if (sessionToken) {
            headers["x-user-auth"] = `Bearer ${sessionToken}`;
          } else if (phone) {
            headers["x-user-phone"] = phone;
          }
          if (adminToken) headers["x-admin-auth"] = `Bearer ${adminToken}`;

          return headers;
        } catch (e) {
          console.log("[trpc] failed to read auth headers", e);
          return {};
        }
      },
    }),
  ],
});
