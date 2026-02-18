import * as fs from "fs";
import * as path from "path";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type StoredValue = unknown;

type StoreRecord = {
  value: StoredValue;
  updatedAt: number;
};

const memoryStore: Map<string, StoreRecord> = new Map();

const getStorePath = (): string => {
  const env = process.env.STORE_PATH;
  if (env && typeof env === "string" && env.trim()) return env.trim();
  return path.join(process.cwd(), "data", "store.json");
};

let persistScheduled: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DEBOUNCE_MS = 500;

function schedulePersist(): void {
  if (persistScheduled) return;
  persistScheduled = setTimeout(() => {
    persistScheduled = null;
    persistToFile().catch((e) => console.error("[store] persist failed", e));
  }, PERSIST_DEBOUNCE_MS);
}

async function persistToFile(): Promise<void> {
  const filePath = getStorePath();
  const dir = path.dirname(filePath);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const obj: Record<string, StoreRecord> = {};
    for (const [k, v] of memoryStore) obj[k] = v;
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 0), "utf8");
  } catch (e) {
    console.error("[store] persistToFile error", e);
  }
}

export async function initStore(): Promise<void> {
  const filePath = getStorePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const obj = JSON.parse(raw) as Record<string, StoreRecord>;
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === "object" && "value" in v) {
          memoryStore.set(k, { value: v.value, updatedAt: v.updatedAt ?? Date.now() });
        }
      }
      console.log("[store] loaded from file", filePath, "keys:", memoryStore.size);
    }
  } catch (e) {
    console.warn("[store] load from file failed, starting empty", e);
  }
}

const hasRorkDbEnv = () => {
  const endpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
  const namespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
  const token = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

  return !!endpoint && !!namespace && !!token;
};

async function rorkDbFetch<T>(path: string, init: RequestInit): Promise<T> {
  const endpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
  const namespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
  const token = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

  if (!endpoint || !namespace || !token) {
    throw new Error("Missing Rork DB env vars");
  }

  const url = `${endpoint.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-rork-namespace": namespace,
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.log("[backend][store] rorkDbFetch failed", {
      url,
      status: res.status,
      text,
    });
    throw new Error(`Rork DB request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function storeGet<T>(key: string): Promise<T | null> {
  if (!key) return null;

  if (hasRorkDbEnv()) {
    try {
      const data = await rorkDbFetch<{ value: T | null }>("kv/get", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      return (data?.value ?? null) as T | null;
    } catch (e) {
      console.log("[backend][store] falling back to memory on get", { key, e });
    }
  }

  const rec = memoryStore.get(key);
  return (rec?.value ?? null) as T | null;
}

export async function storeSet<T>(key: string, value: T): Promise<void> {
  if (!key) return;

  if (hasRorkDbEnv()) {
    try {
      await rorkDbFetch<{ ok: true }>("kv/set", {
        method: "POST",
        body: JSON.stringify({ key, value }),
      });
      return;
    } catch (e) {
      console.log("[backend][store] falling back to memory on set", { key, e });
    }
  }

  memoryStore.set(key, { value, updatedAt: Date.now() });
  schedulePersist();
}

export async function storeDelete(key: string): Promise<void> {
  if (!key) return;

  if (hasRorkDbEnv()) {
    try {
      await rorkDbFetch<{ ok: true }>("kv/delete", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      return;
    } catch (e) {
      console.log("[backend][store] falling back to memory on delete", { key, e });
    }
  }

  memoryStore.delete(key);
  schedulePersist();
}

/**
 * Получить все записи по префиксу ключа.
 * Возвращает объект: { "key1": value1, "key2": value2, ... }
 */
export async function storeGetAll<T>(prefix: string): Promise<Record<string, T>> {
  const result: Record<string, T> = {};
  const keys = await storeListKeys(prefix);
  for (const key of keys) {
    const val = await storeGet<T>(key);
    if (val !== null) {
      result[key] = val;
    }
  }
  return result;
}

export async function storeListKeys(prefix: string): Promise<string[]> {
  if (hasRorkDbEnv()) {
    try {
      const data = await rorkDbFetch<{ keys: string[] }>("kv/list", {
        method: "POST",
        body: JSON.stringify({ prefix }),
      });
      return data?.keys ?? [];
    } catch (e) {
      console.log("[backend][store] falling back to memory on listKeys", {
        prefix,
        e,
      });
    }
  }

  const keys: string[] = [];
  for (const k of memoryStore.keys()) {
    if (k.startsWith(prefix)) keys.push(k);
  }
  return keys;
}
