#!/usr/bin/env node
/**
 * Create human-review branches for swarm-generated corpus fixtures (no auto-merge).
 *
 * Usage:
 *   node security-swarm/scripts/open-corpus-pr.mjs [--dry-run]
 *
 * Requires: git, evasion-promotions.json from evasion-generate.mjs
 * CI: use workflow_dispatch in .github/workflows/security-swarm-corpus-pr.yml when GH token write is available.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { verifyEvasionManifest, getEvasionSigningKey } from '../lib/evasion-sign.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const MANIFEST = join(REPO, 'reports', 'security-swarm', 'evasion-promotions.json');
const DRY = process.argv.includes('--dry-run');

function git(...args) {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf-8' });
  if (r.status !== 0) {
    console.error(`[open-corpus-pr] git ${args.join(' ')} failed:\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
  return (r.stdout || '').trim();
}

if (!existsSync(MANIFEST)) {
  console.error('[open-corpus-pr] Missing evasion-promotions.json — run evasion-generate first');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
if (getEvasionSigningKey()) {
  const verify = verifyEvasionManifest(manifest);
  if (!verify.ok) {
    console.error(`[open-corpus-pr] Invalid evasion manifest: ${verify.reason}`);
    process.exit(1);
  }
} else if (manifest.signature) {
  console.error('[open-corpus-pr] Manifest is signed but GUARDIAN_SWARM_EVASION_SIGNING_KEY is unset');
  process.exit(1);
}
const { promotions = [] } = manifest;
if (!promotions.length) {
  console.log('[open-corpus-pr] No promotions in manifest');
  process.exit(0);
}

const baseBranch = git('rev-parse', '--abbrev-ref', 'HEAD');
console.log(`[open-corpus-pr] base=${baseBranch} promotions=${promotions.length} dryRun=${DRY}`);

for (const p of promotions) {
  const rel = p.path;
  if (!existsSync(join(REPO, rel))) {
    console.warn(`[open-corpus-pr] skip ${p.id}: missing ${rel}`);
    continue;
  }
  if (DRY) {
    console.log(`[open-corpus-pr] would create branch ${p.branch} with ${rel}`);
    continue;
  }
  git('checkout', baseBranch);
  git('checkout', '-B', p.branch);
  git('add', rel);
  const msg = `swarm: add corpus fixture ${p.id} from bypass promotion`;
  const commit = spawnSync('git', ['commit', '-m', msg], { cwd: REPO, encoding: 'utf-8' });
  if (commit.status !== 0 && !String(commit.stderr || '').includes('nothing to commit')) {
    console.error(`[open-corpus-pr] commit failed for ${p.id}`);
    process.exit(1);
  }
  console.log(`[open-corpus-pr] branch ${p.branch} ready — push and open PR manually:`);
  console.log(`  git push -u origin ${p.branch}`);
  console.log(`  gh pr create --head ${p.branch} --title "Swarm corpus: ${p.id}" --body "Human review required. Run pnpm security-swarm:fast before merge."`);
}

if (!DRY) git('checkout', baseBranch);
console.log('[open-corpus-pr] Done. No auto-merge — human review required.');
