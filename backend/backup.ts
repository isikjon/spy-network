/**
 * Автоматические резервные копии store.json → Telegram бот.
 * - Каждые 4 часа отправляет бэкап в Telegram
 * - Хранит последние 7 локальных бэкапов
 * - Env: TG_BACKUP_BOT_TOKEN, TG_BACKUP_CHAT_ID
 */

import * as fs from "fs";
import * as path from "path";

const BACKUP_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 часа
const MAX_BACKUPS = 7;

function getStorePath(): string {
  const env = process.env.STORE_PATH;
  if (env && typeof env === "string" && env.trim()) return env.trim();
  return path.join(process.cwd(), "data", "store.json");
}

function getBackupDir(): string {
  return path.join(path.dirname(getStorePath()), "backups");
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}_${h}-${min}`;
}

async function sendToTelegram(filePath: string, fileName: string): Promise<boolean> {
  const botToken = process.env.TG_BACKUP_BOT_TOKEN;
  const chatId = process.env.TG_BACKUP_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("[backup] TG_BACKUP_BOT_TOKEN or TG_BACKUP_CHAT_ID not set, skipping Telegram");
    return false;
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const sizeKb = Math.round(fileBuffer.length / 1024);

    const boundary = "----BackupBoundary" + Date.now();
    const caption = `Backup\n${fileName}\n${(sizeKb / 1024).toFixed(2)} MB\n${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`;

    const bodyParts: Buffer[] = [];

    const addField = (name: string, value: string) => {
      bodyParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      ));
    };

    addField("chat_id", chatId);
    addField("caption", caption);

    bodyParts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    ));
    bodyParts.push(fileBuffer);
    bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(bodyParts);

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });

    const data = (await res.json()) as any;
    if (data.ok) {
      console.log(`[backup] sent to Telegram: ${fileName} (${sizeKb}KB)`);
      return true;
    } else {
      console.error("[backup] Telegram API error", data);
      return false;
    }
  } catch (e) {
    console.error("[backup] failed to send to Telegram", e);
    return false;
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

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupName = `store-backup-${formatDate(new Date())}.json`;
    const backupPath = path.join(backupDir, backupName);

    fs.copyFileSync(storePath, backupPath);

    const stats = fs.statSync(backupPath);
    const sizeKb = Math.round(stats.size / 1024);
    console.log(`[backup] created ${backupName} (${sizeKb}KB)`);

    await sendToTelegram(backupPath, backupName);
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
      .sort()
      .reverse();

    if (files.length <= MAX_BACKUPS) return;

    const toDelete = files.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      fs.unlinkSync(path.join(backupDir, file));
      console.log(`[backup] deleted old: ${file}`);
    }
  } catch (e) {
    console.error("[backup] cleanup failed", e);
  }
}

let backupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Запуск: первый бэкап через 1 минуту, потом каждые 4 часа.
 */
export function startBackupScheduler(): void {
  console.log("[backup] scheduler started, interval: 4h, Telegram:",
    process.env.TG_BACKUP_BOT_TOKEN ? "configured" : "NOT configured");

  setTimeout(() => {
    createBackup();
    backupInterval = setInterval(createBackup, BACKUP_INTERVAL_MS);
  }, 60 * 1000);
}

export function stopBackupScheduler(): void {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
}

export { createBackup };
