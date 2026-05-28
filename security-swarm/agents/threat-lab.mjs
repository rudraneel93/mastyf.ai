#!/usr/bin/env node
/**
 * Threat Lab agent — LLM-driven threat discovery (Pro-gated via gate-pro in orchestrator).
 * Delegates to scripts/security-swarm/run-threat-lab.ts
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');

if (process.env.SWARM_THREAT_LAB !== 'true') {
  console.log('[threat-lab] SWARM_THREAT_LAB not enabled — skipping');
  process.exit(0);
}

const script = join(REPO, 'scripts', 'security-swarm', 'run-threat-lab.ts');
if (!existsSync(script)) {
  console.error('[threat-lab] Missing run-threat-lab.ts');
  process.exit(1);
}

const r = spawnSync('node', ['--import', 'tsx/esm', script], {
  cwd: REPO,
  stdio: 'inherit',
  env: {
    ...process.env,
    SWARM_THREAT_LAB_REQUIRE_LLM: process.env.SWARM_THREAT_LAB_REQUIRE_LLM ?? 'true',
  },
});

process.exit(r.status ?? 1);
