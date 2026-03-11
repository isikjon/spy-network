/**
 * Бэкапы store.json → Telegram бот.
 * - Пользователь пишет боту пароль → получает бэкапы каждые 4 часа
 * - Env: TG_BACKUP_BOT_TOKEN, TG_BACKUP_PASSWORD (default: SNB-4F8K-X2QZ-7WPM)
 */

import * as fs from "fs";
import * as path from "path";

const BACKUP_INTERVAL_MS = 4 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 5000;
const MAX_BACKUPS = 7;

const subscribers = new Set<number>();
let lastUpdateId = 0;

function getBotToken(): string | null {
  return process.env.TG_BACKUP_BOT_TOKEN || null;
}

function getPassword(): string {
  return process.env.TG_BACKUP_PASSWORD || "SNB-4F8K-X2QZ-7WPM";
}

function getDataDir(): string {
  const env = process.env.STORE_PATH;
  if (env && typeof env === "string" && env.trim()) return path.dirname(env.trim());
  return path.join(process.cwd(), "data");
}

function getStorePath(): string {
  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, "store.db");
  const jsonPath = path.join(dataDir, "store.json");

  if (fs.existsSync(dbPath)) {
    const stat = fs.statSync(dbPath);
    if (stat.size > 0) return dbPath;
    console.log("[backup] store.db exists but is empty, using store.json");
  }
  return jsonPath;
}

function getBackupDir(): string {
  return path.join(path.dirname(getStorePath()), "backups");
}

function getSubscribersPath(): string {
  return path.join(path.dirname(getStorePath()), "backup-subscribers.json");
}

function loadSubscribers(): void {
  try {
    const p = getSubscribersPath();
    if (fs.existsSync(p)) {
      const ids = JSON.parse(fs.readFileSync(p, "utf8")) as number[];
      ids.forEach((id) => subscribers.add(id));
      console.log("[backup] loaded subscribers:", subscribers.size);
    }
  } catch (e) {
    console.error("[backup] failed to load subscribers", e);
  }
}

function saveSubscribers(): void {
  try {
    const p = getSubscribersPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify([...subscribers]), "utf8");
  } catch (e) {
    console.error("[backup] failed to save subscribers", e);
  }
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}_${h}-${min}`;
}

async function tgApi(method: string, body?: any): Promise<any> {
  const token = getBotToken();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json();
  } catch (e) {
    console.error(`[backup] tgApi ${method} error`, e);
    return null;
  }
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  await tgApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}

async function sendFileToChat(chatId: number, filePath: string, fileName: string): Promise<boolean> {
  const token = getBotToken();
  if (!token) return false;

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const sizeKb = Math.round(fileBuffer.length / 1024);
    const boundary = "----Backup" + Date.now();
    const caption = `📦 Backup\n${fileName}\n${(sizeKb / 1024).toFixed(2)} MB\n${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`;

    const parts: Buffer[] = [];
    const field = (name: string, value: string) => {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    };

    field("chat_id", String(chatId));
    field("caption", caption);
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: Buffer.concat(parts),
    });
    const data = (await res.json()) as any;
    return !!data.ok;
  } catch (e) {
    console.error("[backup] sendFile error for chat", chatId, e);
    return false;
  }
}

async function pollUpdates(): Promise<void> {
  const data = await tgApi("getUpdates", {
    offset: lastUpdateId + 1,
    timeout: 0,
    allowed_updates: ["message"],
  });

  if (!data?.ok || !Array.isArray(data.result)) return;

  for (const update of data.result) {
    lastUpdateId = Math.max(lastUpdateId, update.update_id);
    const msg = update.message;
    if (!msg?.text || !msg?.chat?.id) continue;

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (text === "/start") {
      await sendMessage(chatId,
        "🔒 <b>Spy Network — Backup Bot</b>\n\n" +
        "Для получения автоматических бэкапов базы данных, отправьте код доступа.\n\n" +
        "Команды:\n/status — статус подписки\n/stop — отменить подписку"
      );
    } else if (text === "/status") {
      if (subscribers.has(chatId)) {
        await sendMessage(chatId, "✅ Подписка активна. Бэкапы приходят каждые 4 часа.");
      } else {
        await sendMessage(chatId, "❌ Подписка не активна. Отправьте код доступа.");
      }
    } else if (text === "/stop") {
      if (subscribers.has(chatId)) {
        subscribers.delete(chatId);
        saveSubscribers();
        await sendMessage(chatId, "🚫 Подписка отменена. Бэкапы больше не будут приходить.");
      } else {
        await sendMessage(chatId, "Вы не подписаны.");
      }
    } else if (text === getPassword()) {
      subscribers.add(chatId);
      saveSubscribers();
      await sendMessage(chatId,
        "✅ <b>Подписка активирована!</b>\n\n" +
        "Бэкапы базы данных будут приходить каждые 4 часа.\n" +
        "Формат: <u>spy-network-backup-ГГГГ-ММ-ДД_ЧЧ-ММ.db</u>\n\n" +
        "/stop — отменить подписку"
      );
      console.log("[backup] new subscriber:", chatId);
    }
  }
}

function escSql(val: string): string {
  return val.replace(/'/g, "''");
}

function jsonToSql(storePath: string): string {
  const raw = fs.readFileSync(storePath, "utf8");
  const store = JSON.parse(raw) as Record<string, { value: unknown; updatedAt: number }>;

  const lines: string[] = [];
  const ts = new Date().toISOString();

  lines.push(`-- Spy Network Database Backup`);
  lines.push(`-- Generated: ${ts}`);
  lines.push(`-- Format: SQL (from JSON key-value store)`);
  lines.push(``);

  lines.push(`DROP TABLE IF EXISTS kv_store;`);
  lines.push(`CREATE TABLE kv_store (`);
  lines.push(`  key TEXT PRIMARY KEY,`);
  lines.push(`  value TEXT NOT NULL,`);
  lines.push(`  updated_at BIGINT`);
  lines.push(`);`);
  lines.push(``);

  for (const [key, rec] of Object.entries(store)) {
    if (!rec || typeof rec !== "object") continue;
    const val = JSON.stringify(rec.value ?? null);
    const updAt = rec.updatedAt ?? 0;
    lines.push(`INSERT INTO kv_store (key, value, updated_at) VALUES ('${escSql(key)}', '${escSql(val)}', ${updAt});`);
  }

  lines.push(``);
  lines.push(`-- Normalized tables`);
  lines.push(``);

  lines.push(`DROP TABLE IF EXISTS users;`);
  lines.push(`CREATE TABLE users (`);
  lines.push(`  phone TEXT PRIMARY KEY,`);
  lines.push(`  dossiers_count INTEGER DEFAULT 0,`);
  lines.push(`  level INTEGER DEFAULT 1,`);
  lines.push(`  subscribed_until BIGINT,`);
  lines.push(`  has_card INTEGER DEFAULT 0,`);
  lines.push(`  updated_at BIGINT`);
  lines.push(`);`);
  lines.push(``);

  lines.push(`DROP TABLE IF EXISTS dossiers;`);
  lines.push(`CREATE TABLE dossiers (`);
  lines.push(`  id TEXT,`);
  lines.push(`  owner_phone TEXT,`);
  lines.push(`  name TEXT,`);
  lines.push(`  phone TEXT,`);
  lines.push(`  sectors TEXT,`);
  lines.push(`  created_at BIGINT`);
  lines.push(`);`);
  lines.push(``);

  lines.push(`DROP TABLE IF EXISTS user_levels;`);
  lines.push(`CREATE TABLE user_levels (`);
  lines.push(`  phone TEXT PRIMARY KEY,`);
  lines.push(`  level INTEGER DEFAULT 1,`);
  lines.push(`  subscribed_until BIGINT,`);
  lines.push(`  updated_at BIGINT`);
  lines.push(`);`);
  lines.push(``);

  lines.push(`DROP TABLE IF EXISTS payment_methods;`);
  lines.push(`CREATE TABLE payment_methods (`);
  lines.push(`  phone TEXT PRIMARY KEY,`);
  lines.push(`  payment_method_id TEXT,`);
  lines.push(`  card_last4 TEXT,`);
  lines.push(`  card_type TEXT,`);
  lines.push(`  saved_at BIGINT`);
  lines.push(`);`);
  lines.push(``);

  const phones = new Set<string>();
  for (const key of Object.keys(store)) {
    const m = key.match(/^user:(\d+):data$/);
    if (m) phones.add(m[1]);
  }

  for (const phone of phones) {
    const dataRec = store[`user:${phone}:data`];
    const levelRec = store[`user:${phone}:level`];
    const cardRec = store[`user:${phone}:payment_method`];

    const data = (dataRec?.value ?? {}) as Record<string, any>;
    const level = (levelRec?.value ?? {}) as Record<string, any>;
    const card = (cardRec?.value ?? null) as Record<string, any> | null;

    const dossiers = Array.isArray(data.dossiers) ? data.dossiers : [];
    const lvl = typeof level.level === "number" ? level.level : 1;
    const subUntil = typeof level.subscribedUntil === "number" ? level.subscribedUntil : null;
    const hasCard = card?.paymentMethodId ? 1 : 0;
    const updAt = dataRec?.updatedAt ?? 0;

    lines.push(`INSERT INTO users (phone, dossiers_count, level, subscribed_until, has_card, updated_at) VALUES ('${escSql(phone)}', ${dossiers.length}, ${lvl}, ${subUntil ?? "NULL"}, ${hasCard}, ${updAt});`);

    if (levelRec) {
      lines.push(`INSERT INTO user_levels (phone, level, subscribed_until, updated_at) VALUES ('${escSql(phone)}', ${lvl}, ${subUntil ?? "NULL"}, ${levelRec.updatedAt ?? 0});`);
    }

    if (card?.paymentMethodId) {
      lines.push(`INSERT INTO payment_methods (phone, payment_method_id, card_last4, card_type, saved_at) VALUES ('${escSql(phone)}', '${escSql(String(card.paymentMethodId))}', '${escSql(String(card.cardLast4 || ""))}', '${escSql(String(card.cardType || ""))}', ${card.savedAt ?? 0});`);
    }

    for (const d of dossiers) {
      const did = escSql(String(d.id || ""));
      const dname = escSql(String(d.name || d.fullName || ""));
      const dphone = escSql(String(d.phone || d.phoneNumber || ""));
      const dsectors = escSql(Array.isArray(d.sectors) ? d.sectors.join(",") : "");
      const dcreated = d.createdAt ?? d.addedAt ?? 0;
      lines.push(`INSERT INTO dossiers (id, owner_phone, name, phone, sectors, created_at) VALUES ('${did}', '${escSql(phone)}', '${dname}', '${dphone}', '${dsectors}', ${dcreated});`);
    }
  }

  lines.push(``);
  lines.push(`-- End of backup`);
  return lines.join("\n");
}

async function createBackup(): Promise<void> {
  const storePath = getStorePath();
  const backupDir = getBackupDir();
  const isSqlite = storePath.endsWith(".db");

  try {
    if (!fs.existsSync(storePath)) {
      console.log("[backup] store not found at", storePath, "skipping");
      return;
    }

    const storeSize = fs.statSync(storePath).size;
    if (storeSize === 0) {
      console.log("[backup] store file is empty (0 bytes) at", storePath, "skipping");
      return;
    }
    console.log("[backup] store file:", storePath, "size:", Math.round(storeSize / 1024), "KB");

    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const dateStr = formatDate(new Date());
    const filesToSend: { path: string; name: string }[] = [];

    if (isSqlite) {
      const dbBackupName = `spy-network-backup-${dateStr}.db`;
      const dbBackupPath = path.join(backupDir, dbBackupName);
      fs.copyFileSync(storePath, dbBackupPath);

      const walPath = storePath + "-wal";
      if (fs.existsSync(walPath)) {
        const walBackupName = `spy-network-backup-${dateStr}.db-wal`;
        const walBackupPath = path.join(backupDir, walBackupName);
        fs.copyFileSync(walPath, walBackupPath);
      }

      const sizeKb = Math.round(fs.statSync(dbBackupPath).size / 1024);
      console.log(`[backup] created ${dbBackupName} (${sizeKb}KB) [SQLite], sending to ${subscribers.size} subscribers`);
      filesToSend.push({ path: dbBackupPath, name: dbBackupName });
    } else {
      const jsonBackupName = `spy-network-backup-${dateStr}.json`;
      const jsonBackupPath = path.join(backupDir, jsonBackupName);
      fs.copyFileSync(storePath, jsonBackupPath);

      const sqlContent = jsonToSql(storePath);
      const sqlBackupName = `spy-network-backup-${dateStr}.sql`;
      const sqlBackupPath = path.join(backupDir, sqlBackupName);
      fs.writeFileSync(sqlBackupPath, sqlContent, "utf8");

      console.log(`[backup] created ${sqlBackupName} + ${jsonBackupName}, sending to ${subscribers.size} subscribers`);
      filesToSend.push({ path: sqlBackupPath, name: sqlBackupName });
      filesToSend.push({ path: jsonBackupPath, name: jsonBackupName });
    }

    const validFiles = filesToSend.filter((f) => {
      const size = fs.statSync(f.path).size;
      if (size === 0) {
        console.warn("[backup] skipping empty file:", f.name);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      console.warn("[backup] all backup files are empty, nothing to send");
      return;
    }

    for (const chatId of subscribers) {
      for (const f of validFiles) {
        const ok = await sendFileToChat(chatId, f.path, f.name);
        if (!ok) console.warn("[backup] failed to send", f.name, "to", chatId);
      }
    }

    await cleanupOldBackups();
  } catch (e) {
    console.error("[backup] failed", e);
  }
}

async function cleanupOldBackups(): Promise<void> {
  const backupDir = getBackupDir();
  try {
    if (!fs.existsSync(backupDir)) return;
    const files = fs.readdirSync(backupDir)
      .filter((f) => (f.startsWith("store-backup-") || f.startsWith("spy-network-backup-")) && (f.endsWith(".json") || f.endsWith(".sql") || f.endsWith(".db") || f.endsWith(".db-wal")))
      .sort().reverse();
    if (files.length <= MAX_BACKUPS) return;
    for (const file of files.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(backupDir, file));
      console.log(`[backup] deleted old: ${file}`);
    }
  } catch (e) {
    console.error("[backup] cleanup failed", e);
  }
}

let backupInterval: ReturnType<typeof setInterval> | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startBackupScheduler(): void {
  const token = getBotToken();
  const storePath = getStorePath();
  const storeExists = fs.existsSync(storePath);
  const storeSize = storeExists ? fs.statSync(storePath).size : 0;

  console.log("[backup] scheduler started", {
    interval: "4h",
    bot: token ? "configured" : "NOT configured (set TG_BACKUP_BOT_TOKEN)",
    storePath,
    storeExists,
    storeSizeKB: Math.round(storeSize / 1024),
    dataDir: getDataDir(),
  });

  if (!token) {
    console.warn("[backup] TG_BACKUP_BOT_TOKEN not set — Telegram backup bot DISABLED");
  }

  loadSubscribers();

  if (token) {
    pollInterval = setInterval(pollUpdates, POLL_INTERVAL_MS);
    console.log("[backup] Telegram polling started, subscribers:", subscribers.size);
  }

  setTimeout(() => {
    createBackup();
    backupInterval = setInterval(createBackup, BACKUP_INTERVAL_MS);
  }, 60 * 1000);
}

export function stopBackupScheduler(): void {
  if (backupInterval) { clearInterval(backupInterval); backupInterval = null; }
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

export { createBackup };
