/**
 * Автоматические резервные копии базы данных (store.json).
 * - Запускается при старте сервера
 * - Делает бэкап каждые 24 часа
 * - Хранит последние 7 бэкапов
 */

import * as fs from "fs";
import * as path from "path";

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 часа
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

async function createBackup(): Promise<void> {
  const storePath = getStorePath();
  const backupDir = getBackupDir();

  try {
    if (!fs.existsSync(storePath)) {
      console.log("[backup] store.json not found, skipping backup");
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

    // Удаляем старые бэкапы (оставляем последние MAX_BACKUPS)
    await cleanupOldBackups();
  } catch (e) {
    console.error("[backup] failed to create backup", e);
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
      const filePath = path.join(backupDir, file);
      fs.unlinkSync(filePath);
      console.log(`[backup] deleted old backup: ${file}`);
    }
  } catch (e) {
    console.error("[backup] cleanup failed", e);
  }
}

let backupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Запуск автоматических бэкапов.
 * Делает первый бэкап через 5 минут после запуска, потом каждые 24 часа.
 */
export function startBackupScheduler(): void {
  console.log("[backup] scheduler started, interval: 24h, max backups:", MAX_BACKUPS);

  // Первый бэкап через 5 минут (чтоб сервер успел загрузить данные)
  setTimeout(() => {
    createBackup();
    backupInterval = setInterval(createBackup, BACKUP_INTERVAL_MS);
  }, 5 * 60 * 1000);
}

/**
 * Остановить бэкапы (для тестов).
 */
export function stopBackupScheduler(): void {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
}

/**
 * Ручное создание бэкапа (для админ-API).
 */
export { createBackup };
