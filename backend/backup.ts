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

function getStorePath(): string {
  const env = process.env.STORE_PATH;
  if (env && typeof env === "string" && env.trim()) return env.trim();
  return path.join(process.cwd(), "data", "store.json");
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
        "Формат: <u>store-backup-ГГГГ-ММ-ДД_ЧЧ-ММ.json</u>\n\n" +
        "/stop — отменить подписку"
      );
      console.log("[backup] new subscriber:", chatId);
    }
  }
}

async function createBackup(): Promise<void> {
  const storePath = getStorePath();
  const backupDir = getBackupDir();

  try {
    if (!fs.existsSync(storePath)) {
      console.log("[backup] store.json not found, skipping");
      return;
    }
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const backupName = `store-backup-${formatDate(new Date())}.json`;
    const backupPath = path.join(backupDir, backupName);
    fs.copyFileSync(storePath, backupPath);

    const sizeKb = Math.round(fs.statSync(backupPath).size / 1024);
    console.log(`[backup] created ${backupName} (${sizeKb}KB), sending to ${subscribers.size} subscribers`);

    for (const chatId of subscribers) {
      const ok = await sendFileToChat(chatId, backupPath, backupName);
      if (!ok) console.warn("[backup] failed to send to", chatId);
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
      .filter((f) => f.startsWith("store-backup-") && f.endsWith(".json"))
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
  console.log("[backup] scheduler started, interval: 4h, bot:", token ? "configured" : "NOT configured");

  loadSubscribers();

  if (token) {
    pollInterval = setInterval(pollUpdates, POLL_INTERVAL_MS);
    console.log("[backup] Telegram polling started");
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
