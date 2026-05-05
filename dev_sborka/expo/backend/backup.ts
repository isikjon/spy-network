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
    console.log("[backup] Node.js modules not available, backups disabled");
    return false;
  }
}

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_BACKUPS = 7;

function getStorePath(): string | null {
  if (!nodePath || !nodeOs) return null;
  const env = process.env.STORE_PATH;
  if (env && typeof env === "string" && env.trim()) return env.trim();
  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID || "default-project";
  return nodePath.join(nodeOs.tmpdir(), "rork-app-data", `${projectId}-store.json`);
}

function getBackupDir(): string | null {
  if (!nodePath) return null;
  const sp = getStorePath();
  if (!sp) return null;
  return nodePath.join(nodePath.dirname(sp), "backups");
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
  const hasNode = await loadNodeModules();
  if (!hasNode || !nodeFs || !nodePath) {
    console.log("[backup] skipping backup: no filesystem access");
    return;
  }

  const storePath = getStorePath();
  const backupDir = getBackupDir();
  if (!storePath || !backupDir) return;

  try {
    if (!nodeFs.existsSync(storePath)) {
      console.log("[backup] store.json not found, skipping backup");
      return;
    }

    if (!nodeFs.existsSync(backupDir)) {
      nodeFs.mkdirSync(backupDir, { recursive: true });
    }

    const backupName = `store-backup-${formatDate(new Date())}.json`;
    const backupPath = nodePath.join(backupDir, backupName);

    nodeFs.copyFileSync(storePath, backupPath);

    const stats = nodeFs.statSync(backupPath);
    const sizeKb = Math.round(stats.size / 1024);
    console.log(`[backup] created ${backupName} (${sizeKb}KB)`);

    await cleanupOldBackups();
  } catch (e) {
    console.error("[backup] failed to create backup", e);
  }
}

async function cleanupOldBackups(): Promise<void> {
  if (!nodeFs || !nodePath) return;
  const backupDir = getBackupDir();
  if (!backupDir) return;

  try {
    if (!nodeFs.existsSync(backupDir)) return;

    const files = nodeFs.readdirSync(backupDir)
      .filter((f) => f.startsWith("store-backup-") && f.endsWith(".json"))
      .sort()
      .reverse();

    if (files.length <= MAX_BACKUPS) return;

    const toDelete = files.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      const filePath = nodePath.join(backupDir, file);
      nodeFs.unlinkSync(filePath);
      console.log(`[backup] deleted old backup: ${file}`);
    }
  } catch (e) {
    console.error("[backup] cleanup failed", e);
  }
}

let backupInterval: ReturnType<typeof setInterval> | null = null;

export function startBackupScheduler(): void {
  console.log("[backup] scheduler started, interval: 24h, max backups:", MAX_BACKUPS);

  setTimeout(() => {
    void createBackup();
    backupInterval = setInterval(createBackup, BACKUP_INTERVAL_MS);
  }, 5 * 60 * 1000);
}

export function stopBackupScheduler(): void {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
}

export { createBackup };
