#!/usr/bin/env node
/**
 * Shadow red team agent — safe scheduled probes against tool baselines.
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');

if (process.env.SWARM_SHADOW_RED_TEAM !== 'true') {
  console.log('[shadow-red-team] SWARM_SHADOW_RED_TEAM not enabled — skipping');
  process.exit(0);
}

const script = join(REPO, 'scripts', 'security-swarm', 'run-shadow-red-team.ts');
if (!existsSync(script)) {
  console.error('[shadow-red-team] Missing run-shadow-red-team.ts');
  process.exit(1);
}

const r = spawnSync('pnpm', ['exec', 'tsx', script], {
  cwd: REPO,
  stdio: 'inherit',
  env: process.env,
});

process.exit(r.status ?? 0);
