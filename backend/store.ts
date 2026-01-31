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
