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

let nodeFs: typeof import("fs") | null = null;
let nodePath: typeof import("path") | null = null;
let nodeOs: typeof import("os") | null = null;
let nodeModulesLoaded = false;

async function loadNodeModules(): Promise<boolean> {
  if (nodeModulesLoaded) return !!nodeFs;
  nodeModulesLoaded = true;
  try {
    nodeFs = await import("node:fs");
    nodePath = await import("node:path");
    nodeOs = await import("node:os");
    return true;
  } catch {
    console.log("[store] Node.js fs/path/os not available, using memory store");
    return false;
  }
}

function getStorePath(): string | null {
  if (!nodePath || !nodeOs) return null;
  const env = process.env.STORE_PATH;
  if (env && typeof env === "string" && env.trim()) return env.trim();
  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID || "default-project";
  return nodePath.join(nodeOs.tmpdir(), "rork-app-data", `${projectId}-store.json`);
}

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
  if (!nodeFs || !nodePath) return;
  const filePath = getStorePath();
  if (!filePath) return;
  const dir = nodePath.dirname(filePath);
  try {
    if (!nodeFs.existsSync(dir)) {
      nodeFs.mkdirSync(dir, { recursive: true });
    }
    const obj: Record<string, StoreRecord> = {};
    for (const [k, v] of memoryStore) obj[k] = v;
    nodeFs.writeFileSync(filePath, JSON.stringify(obj, null, 0), "utf8");
  } catch (e) {
    console.error("[store] persistToFile error", e);
  }
}

let denoKv: any = null;
let denoKvChecked = false;

async function getDenoKv(): Promise<any | null> {
  if (denoKvChecked) return denoKv;
  denoKvChecked = true;
  try {
    const d = (globalThis as any).Deno;
    if (d && typeof d.openKv === "function") {
      denoKv = await d.openKv();
      console.log("[store] Deno KV available — using as persistence layer");
      return denoKv;
    }
  } catch (e) {
    console.log("[store] Deno KV not available", e);
  }
  denoKv = null;
  return null;
}

async function denoKvGet<T>(key: string): Promise<T | null> {
  const kv = await getDenoKv();
  if (!kv) return null;
  try {
    const result = await kv.get(["rork_store", key]);
    return (result?.value ?? null) as T | null;
  } catch (e) {
    console.log("[store] denoKvGet error", { key, e });
    return null;
  }
}

async function denoKvSet(key: string, value: unknown): Promise<boolean> {
  const kv = await getDenoKv();
  if (!kv) return false;
  try {
    await kv.set(["rork_store", key], value);
    return true;
  } catch (e) {
    console.log("[store] denoKvSet error", { key, e });
    return false;
  }
}

async function denoKvDelete(key: string): Promise<boolean> {
  const kv = await getDenoKv();
  if (!kv) return false;
  try {
    await kv.delete(["rork_store", key]);
    return true;
  } catch (e) {
    console.log("[store] denoKvDelete error", { key, e });
    return false;
  }
}

async function denoKvListKeys(prefix: string): Promise<string[]> {
  const kv = await getDenoKv();
  if (!kv) return [];
  try {
    const keys: string[] = [];
    const iter = kv.list({ prefix: ["rork_store"] });
    for await (const entry of iter) {
      const k = entry.key[1] as string;
      if (typeof k === "string" && k.startsWith(prefix)) {
        keys.push(k);
      }
    }
    return keys;
  } catch (e) {
    console.log("[store] denoKvListKeys error", { prefix, e });
    return [];
  }
}

let rorkDbDisabled = false;
let rorkDbFailCount = 0;
const RORK_DB_MAX_FAILS = 5;
let rorkDbDisabledAt = 0;
const RORK_DB_COOLDOWN_MS = 30_000;

const hasRorkDbEnv = () => {
  if (rorkDbDisabled) {
    if (Date.now() - rorkDbDisabledAt > RORK_DB_COOLDOWN_MS) {
      console.log("[store] Rork DB cooldown expired, re-enabling");
      rorkDbDisabled = false;
      rorkDbFailCount = 0;
    } else {
      return false;
    }
  }

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

  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  headers.set("x-rork-namespace", namespace);
  headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    rorkDbFailCount++;
    console.error("[store] Rork DB request failed", {
      path,
      status: res.status,
      body: text.slice(0, 200),
      failCount: rorkDbFailCount,
      maxFails: RORK_DB_MAX_FAILS,
    });
    if (rorkDbFailCount >= RORK_DB_MAX_FAILS) {
      rorkDbDisabled = true;
      rorkDbDisabledAt = Date.now();
      console.log(`[store] Rork DB temporarily disabled for ${RORK_DB_COOLDOWN_MS / 1000}s after ${rorkDbFailCount} failures`);
    }
    throw new Error(`Rork DB request failed: ${res.status} ${text.slice(0, 100)}`);
  }

  rorkDbFailCount = 0;
  return (await res.json()) as T;
}

export async function initStore(): Promise<void> {
  const hasNode = await loadNodeModules();
  if (hasNode) {
    const filePath = getStorePath();
    if (filePath && nodeFs) {
      try {
        if (nodeFs.existsSync(filePath)) {
          const raw = nodeFs.readFileSync(filePath, "utf8");
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
  }

  const kv = await getDenoKv();
  if (kv) {
    console.log("[store] Deno KV initialized successfully");
  }
}

export async function storeGet<T>(key: string): Promise<T | null> {
  if (!key) return null;

  if (hasRorkDbEnv()) {
    try {
      const data = await rorkDbFetch<{ value: T | null }>("kv/get", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      const val = (data?.value ?? null) as T | null;
      if (val !== null) {
        memoryStore.set(key, { value: val, updatedAt: Date.now() });
      }
      return val;
    } catch (e) {
      console.log("[store] storeGet Rork DB failed, trying fallbacks", { key, error: String(e).slice(0, 120) });
    }
  }

  const denoVal = await denoKvGet<T>(key);
  if (denoVal !== null) {
    memoryStore.set(key, { value: denoVal, updatedAt: Date.now() });
    return denoVal;
  }

  const rec = memoryStore.get(key);
  return (rec?.value ?? null) as T | null;
}

export async function storeSet<T>(key: string, value: T): Promise<void> {
  if (!key) return;

  memoryStore.set(key, { value, updatedAt: Date.now() });

  let rorkDbSaved = false;
  if (hasRorkDbEnv()) {
    try {
      await rorkDbFetch<{ ok: true }>("kv/set", {
        method: "POST",
        body: JSON.stringify({ key, value }),
      });
      rorkDbSaved = true;
    } catch (e) {
      console.log("[store] storeSet Rork DB failed, trying fallbacks", { key, error: String(e).slice(0, 120) });
    }
  }

  const saved = await denoKvSet(key, value);
  if (rorkDbSaved || saved) return;

  schedulePersist();
}

export async function storeDelete(key: string): Promise<void> {
  if (!key) return;

  memoryStore.delete(key);

  let rorkDbDeleted = false;
  if (hasRorkDbEnv()) {
    try {
      await rorkDbFetch<{ ok: true }>("kv/delete", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      rorkDbDeleted = true;
    } catch (e) {
      console.log("[store] storeDelete Rork DB failed", { key, error: String(e).slice(0, 120) });
    }
  }

  if (rorkDbDeleted) return;

  const denoDeleted = await denoKvDelete(key);
  if (!denoDeleted) {
    schedulePersist();
  }
}

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
      console.log("[store] storeListKeys Rork DB failed", { prefix, error: String(e).slice(0, 120) });
    }
  }

  const denoKeys = await denoKvListKeys(prefix);
  if (denoKeys.length > 0) return denoKeys;

  const keys: string[] = [];
  for (const k of memoryStore.keys()) {
    if (k.startsWith(prefix)) keys.push(k);
  }
  return keys;
}
