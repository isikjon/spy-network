import { Database } from "bun:sqlite";
import * as fs from "fs";
import * as path from "path";
import { getDatabase } from "./store";
import { sendBackupToSubscribers, formatBackupName } from "./telegram-bot";

const BACKUP_INTERVAL_MS = 4 * 60 * 60 * 1000;
const MAX_BACKUPS = 30;
const FIRST_BACKUP_DELAY_MS = 2 * 60 * 1000;

function getDbPath(): string {
  const env = process.env.STORE_PATH;
  if (env && typeof env === "string" && env.trim()) {
    return env.trim().replace(/\.json$/, ".db");
  }
  return path.join(process.cwd(), "data", "store.db");
}

function getBackupDir(): string {
  return path.join(path.dirname(getDbPath()), "backups");
}

export async function createBackup(): Promise<void> {
  const db = getDatabase();
  if (!db) {
    console.log("[backup] database not initialized, skipping");
    return;
  }

  const backupDir = getBackupDir();

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const localName = formatBackupName(now);
    const backupPath = path.join(backupDir, localName);

    db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

    const stats = fs.statSync(backupPath);
    const sizeKb = Math.round(stats.size / 1024);
    console.log(`[backup] created ${localName} (${sizeKb}KB)`);

    const integrityOk = verifyBackup(backupPath);
    if (!integrityOk) {
      console.error(`[backup] integrity check FAILED for ${localName}, removing`);
      fs.unlinkSync(backupPath);
      return;
    }

    console.log(`[backup] integrity OK, sending to Telegram...`);
    await sendBackupToSubscribers(backupPath);

    await cleanupOldBackups();
  } catch (e) {
    console.error("[backup] failed to create backup", e);
  }
}

function verifyBackup(backupPath: string): boolean {
  try {
    const testDb = new Database(backupPath, { readonly: true });
    const row = testDb.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    const ok = row?.integrity_check === "ok";
    testDb.close();
    return ok;
  } catch (e) {
    console.error("[backup] verify failed", e);
    return false;
  }
}

async function cleanupOldBackups(): Promise<void> {
  const backupDir = getBackupDir();

  try {
    if (!fs.existsSync(backupDir)) return;

    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith(".sqlite"))
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

export function startBackupScheduler(): void {
  console.log(
    `[backup] scheduler started, interval: ${BACKUP_INTERVAL_MS / 3600000}h, max backups: ${MAX_BACKUPS}`,
  );

  setTimeout(() => {
    createBackup();
    backupInterval = setInterval(createBackup, BACKUP_INTERVAL_MS);
  }, FIRST_BACKUP_DELAY_MS);
}

export function stopBackupScheduler(): void {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
}
