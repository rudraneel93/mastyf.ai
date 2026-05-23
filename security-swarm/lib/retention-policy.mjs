/**
 * H14 — Retention policy for archived swarm artifacts (compress + prune).
 */
import { createGzip } from 'node:zlib';
import { createReadStream, createWriteStream, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const DEFAULT_RETENTION_DAYS = parseInt(process.env.SWARM_ARCHIVE_RETENTION_DAYS || '30', 10);

export async function applySwarmRetention(outDir, retentionDays = DEFAULT_RETENTION_DAYS) {
  const archiveRoot = join(outDir, 'archive');
  if (!existsSync(archiveRoot)) return { pruned: 0, compressed: 0 };

  const cutoff = Date.now() - retentionDays * 86_400_000;
  let pruned = 0;
  let compressed = 0;

  for (const name of readdirSync(archiveRoot)) {
    const dir = join(archiveRoot, name);
    let mtimeMs;
    try {
      mtimeMs = statSync(dir).mtimeMs;
    } catch {
      continue;
    }
    if (mtimeMs < cutoff) {
      rmSync(dir, { recursive: true, force: true });
      pruned++;
      continue;
    }
    const marker = join(dir, '.gz');
    if (existsSync(marker)) continue;
    const tarLike = ['latest.json', 'report.json', 'summary.md'].filter((f) => existsSync(join(dir, f)));
    if (tarLike.length === 0) continue;
    const gzPath = join(dir, 'bundle.json.gz');
    await pipeline(createReadStream(join(dir, tarLike[0])), createGzip(), createWriteStream(gzPath));
    createWriteStream(marker).end('1');
    compressed++;
  }

  return { pruned, compressed, retentionDays };
}
