#!/usr/bin/env node
/**
 * Scout agent — dependency audit (supply-chain signal). No mocks.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const OUT_DIR = join(REPO, 'reports', 'security-swarm');

mkdirSync(OUT_DIR, { recursive: true });

const r = spawnSync('pnpm', ['audit', '--audit-level=high', '--json'], {
  cwd: REPO,
  encoding: 'utf-8',
  env: process.env,
});

let audit = { ok: r.status === 0, status: r.status, advisories: [] };
try {
  const parsed = JSON.parse(r.stdout || '{}');
  const meta = parsed.metadata?.vulnerabilities || {};
  audit.summary = meta;
  audit.ok = (meta.high || 0) === 0 && (meta.critical || 0) === 0;
} catch {
  audit.parseError = (r.stderr || r.stdout || '').slice(0, 2000);
}

const out = {
  agent: 'scout',
  timestamp: new Date().toISOString(),
  audit,
};

writeFileSync(join(OUT_DIR, 'scout.json'), JSON.stringify(out, null, 2));
console.log(`[scout] audit ok=${audit.ok}`);
process.exit(audit.ok ? 0 : 1);
