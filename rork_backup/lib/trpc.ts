import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpBatchLink } from "@trpc/client";
import { Platform } from "react-native";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = (): string => {
  if (Platform.OS === "web") {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (origin) {
      console.log("[trpc] baseUrl(web)", { origin });
      return origin;
    }
  }

  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (!url) {
    throw new Error("Missing EXPO_PUBLIC_RORK_API_BASE_URL. Please contact support.");
  }

  console.log("[trpc] baseUrl(env)", { url });
  return url;
};

const USER_PHONE_STORAGE_KEY = "user_phone" as const;
const ADMIN_TOKEN_STORAGE_KEY = "admin_auth_token" as const;

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: async (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof Request
              ? input.url
              : input.toString();
        try {
          const res = await fetch(input, init);
          if (!res.ok) {
            let bodySnippet = "";
            try {
              const text = await res.clone().text();
              bodySnippet = text.slice(0, 300);
            } catch {
              bodySnippet = "";
            }
            console.log("[trpc] HTTP error", {
              url,
              status: res.status,
              statusText: res.statusText,
              bodySnippet,
            });
          }
          return res;
        } catch (e) {
          console.log("[trpc] network error", { url, error: String(e) });
          throw e;
        }
      },
      headers: async () => {
        try {
          const [phone, adminToken] = await Promise.all([
            AsyncStorage.getItem(USER_PHONE_STORAGE_KEY),
            AsyncStorage.getItem(ADMIN_TOKEN_STORAGE_KEY),
          ]);

          const headers: Record<string, string> = {};
          if (phone) headers["x-user-phone"] = phone;
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
