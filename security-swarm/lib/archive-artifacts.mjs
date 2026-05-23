/**
 * H12 — Archive current swarm artifacts before a new run (timestamped snapshot).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ARCHIVE_FILES = [
  'latest.json',
  'report.json',
  'summary.md',
  'swarm-report.txt',
  'steps.json',
  'bypasses.json',
];

export function archiveSwarmArtifacts(outDir) {
  const archiveRoot = join(outDir, 'archive');
  mkdirSync(archiveRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destDir = join(archiveRoot, stamp);
  mkdirSync(destDir, { recursive: true });

  let archived = 0;
  for (const name of ARCHIVE_FILES) {
    const src = join(outDir, name);
    if (!existsSync(src)) continue;
    copyFileSync(src, join(destDir, name));
    archived++;
  }
  return { stamp, destDir, archived };
}

export function listArchiveRuns(outDir) {
  const archiveRoot = join(outDir, 'archive');
  if (!existsSync(archiveRoot)) return [];
  return readdirSync(archiveRoot)
    .map((name) => {
      const full = join(archiveRoot, name);
      try {
        return { name, mtimeMs: statSync(full).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}
