import cron from "node-cron";
import { readdirSync, statSync, rmSync } from "fs";
import path from "path";

const TMP_DIR = "/tmp/clipflow";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function cleanOldFolders() {
  try {
    const entries = readdirSync(TMP_DIR);
    const now = Date.now();
    for (const entry of entries) {
      const fullPath = path.join(TMP_DIR, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory() && now - stat.mtimeMs > MAX_AGE_MS) {
        rmSync(fullPath, { recursive: true, force: true });
        console.log(`[cleanup] removed ${fullPath}`);
      }
    }
  } catch {
    // TMP_DIR may not exist yet — that's fine
  }
}

export function startCleanupCron() {
  // Run daily at midnight
  cron.schedule("0 0 * * *", cleanOldFolders);
  console.log("[cleanup] daily cleanup cron registered");
}
