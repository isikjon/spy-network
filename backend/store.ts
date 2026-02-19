import { Database } from "bun:sqlite";
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

let db: Database;

const getDbPath = (): string => {
  const env = process.env.STORE_PATH;
  if (env && typeof env === "string" && env.trim()) {
    return env.trim().replace(/\.json$/, ".db");
  }
  return path.join(process.cwd(), "data", "store.db");
};

export function getDatabase(): Database {
  return db;
}

export async function initStore(): Promise<void> {
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA cache_size = -20000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_kv_prefix ON kv (key)");

  await migrateFromJson(dbPath);

  const row = db.prepare("SELECT COUNT(*) as cnt FROM kv").get() as { cnt: number };
  console.log("[store] SQLite initialized", dbPath, "keys:", row.cnt);
}

async function migrateFromJson(dbPath: string): Promise<void> {
  const jsonPath = dbPath.replace(/\.db$/, ".json");
  if (!fs.existsSync(jsonPath)) return;

  const row = db.prepare("SELECT COUNT(*) as cnt FROM kv").get() as { cnt: number };
  if (row.cnt > 0) {
    console.log("[store] SQLite already has data, skipping JSON migration");
    return;
  }

  console.log("[store] migrating from store.json...");

  try {
    const raw = fs.readFileSync(jsonPath, "utf8");
    const obj = JSON.parse(raw) as Record<string, { value: unknown; updatedAt?: number }>;

    const insert = db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)");
    const migrate = db.transaction(() => {
      let count = 0;
      for (const [key, record] of Object.entries(obj)) {
        if (record && typeof record === "object" && "value" in record) {
          insert.run(key, JSON.stringify(record.value), record.updatedAt ?? Date.now());
          count++;
        }
      }
      return count;
    });

    const migrated = migrate();
    console.log("[store] migrated", migrated, "keys from store.json");

    const backupJson = jsonPath + ".migrated";
    fs.renameSync(jsonPath, backupJson);
    console.log("[store] renamed store.json ->", path.basename(backupJson));
  } catch (e) {
    console.error("[store] JSON migration failed", e);
  }
}

const hasRorkDbEnv = () => {
  const endpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
  const namespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
  const token = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;
  return !!endpoint && !!namespace && !!token;
};

async function rorkDbFetch<T>(p: string, init: RequestInit): Promise<T> {
  const endpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
  const namespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
  const token = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

  if (!endpoint || !namespace || !token) {
    throw new Error("Missing Rork DB env vars");
  }

  const url = `${endpoint.replace(/\/$/, "")}/${p.replace(/^\//, "")}`;

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
    console.log("[store] rorkDbFetch failed", { url, status: res.status, text });
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
      console.log("[store] Rork DB fallback on get", { key });
    }
  }

  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | null;
  if (!row) return null;

  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
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
      console.log("[store] Rork DB fallback on set", { key });
    }
  }

  db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)").run(
    key,
    JSON.stringify(value),
    Date.now(),
  );
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
      console.log("[store] Rork DB fallback on delete", { key });
    }
  }

  db.prepare("DELETE FROM kv WHERE key = ?").run(key);
}

export async function storeGetAll<T>(prefix: string): Promise<Record<string, T>> {
  const result: Record<string, T> = {};

  if (hasRorkDbEnv()) {
    try {
      const keys = await storeListKeys(prefix);
      for (const key of keys) {
        const val = await storeGet<T>(key);
        if (val !== null) result[key] = val;
      }
      return result;
    } catch {
    }
  }

  const rows = db.prepare("SELECT key, value FROM kv WHERE key LIKE ?").all(prefix + "%") as { key: string; value: string }[];
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value) as T;
    } catch {
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
      console.log("[store] Rork DB fallback on listKeys", { prefix });
    }
  }

  const rows = db.prepare("SELECT key FROM kv WHERE key LIKE ?").all(prefix + "%") as { key: string }[];
  return rows.map((r) => r.key);
}
