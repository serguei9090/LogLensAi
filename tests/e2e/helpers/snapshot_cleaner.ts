import fs from "node:fs";
import path from "node:path";

/**
 * snapshot_cleaner.ts
 * Scans the snapshots directory and keeps strictly the last 3 versions
 * for every test visual baseline/capture.
 */
export function pruneSnapshots(
  snapshotsDir: string,
  maxVersionsToKeep = 3,
): {
  retained: number;
  deleted: number;
} {
  if (!fs.existsSync(snapshotsDir)) {
    return { retained: 0, deleted: 0 };
  }

  const files = fs.readdirSync(snapshotsDir);
  // Group files by prefix (e.g. core-ui-table-darwin-1234.png -> base name)
  const grouped: Record<string, Array<{ name: string; fullPath: string; mtime: number }>> = {};

  for (const file of files) {
    const fullPath = path.join(snapshotsDir, file);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      continue;
    }

    // Extract root test identifier by removing version or hash suffix
    const match = file.match(/^(.+?)(?:[-_]\d+)?(\.[^.]+)$/);
    const baseKey = match ? `${match[1]}${match[2]}` : file;

    if (!grouped[baseKey]) {
      grouped[baseKey] = [];
    }
    grouped[baseKey].push({
      name: file,
      fullPath,
      mtime: stat.mtimeMs,
    });
  }

  let deletedCount = 0;
  let retainedCount = 0;

  for (const group of Object.values(grouped)) {
    // Sort descending: latest modified first
    group.sort((a, b) => b.mtime - a.mtime);

    // Keep top maxVersionsToKeep
    const toKeep = group.slice(0, maxVersionsToKeep);
    const toDelete = group.slice(maxVersionsToKeep);

    retainedCount += toKeep.length;

    for (const item of toDelete) {
      try {
        fs.unlinkSync(item.fullPath);
        deletedCount++;
      } catch (err) {
        console.warn(`[SnapshotCleaner] Failed to remove old snapshot: ${item.name}`, err);
      }
    }
  }

  return { retained: retainedCount, deleted: deletedCount };
}
