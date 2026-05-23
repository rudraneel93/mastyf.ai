#!/usr/bin/env node
/**
 * CI-friendly 50-replica proxy scale smoke (mcp tests 31 §3.3).
 *
 * Env:
 *   SCALE_PROXY_REPLICAS (default 50)
 *   SCALE_PROXY_TOTAL_CALLS (default 250, must divide replicas)
 *   SCALE_PROXY_STRICT (default false in CI)
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..');
const REPLICAS = parseInt(process.env.SCALE_PROXY_REPLICAS || '50', 10);
const TOTAL = parseInt(process.env.SCALE_PROXY_TOTAL_CALLS || '250', 10);
const STRICT = process.env.SCALE_PROXY_STRICT === 'true';

if (TOTAL % REPLICAS !== 0) {
  console.error(`SCALE_PROXY_TOTAL_CALLS (${TOTAL}) must divide SCALE_PROXY_REPLICAS (${REPLICAS})`);
  process.exit(1);
}

console.log(`[scale-proxy] ${REPLICAS} replicas × ${TOTAL / REPLICAS} calls = ${TOTAL} total`);

const r = spawnSync(
  'pnpm',
  ['exec', 'tsx', 'benchmarks/concurrent-multi-proxy.ts'],
  {
    cwd: REPO,
    stdio: 'inherit',
    env: {
      ...process.env,
      BENCH_PROXY_REPLICAS: String(REPLICAS),
      BENCH_TOTAL_CALLS: String(TOTAL),
      BENCH_STRICT: STRICT ? 'true' : 'false',
      LOG_LEVEL: process.env.LOG_LEVEL || 'error',
    },
  },
);

process.exit(r.status ?? 1);
