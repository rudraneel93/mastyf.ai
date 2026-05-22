#!/usr/bin/env node
/**
 * Evasion agent — promote documented bypasses into new adv-*.json fixtures (template mutation from corpus).
 * Does not auto-merge; writes fixtures + promotion manifest for human-reviewed PRs.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const CUSTOM = join(REPO, 'adversarial-harness', 'fixtures', 'custom-attacks');
const CORPUS_ATTACKS = join(REPO, 'corpus', 'attacks');
const OUT_DIR = join(REPO, 'reports', 'security-swarm');
const MANIFEST = join(OUT_DIR, 'evasion-promotions.json');

mkdirSync(CUSTOM, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function nextAdvId() {
  const files = readdirSync(CUSTOM).filter((f) => f.startsWith('adv-') && f.endsWith('.json'));
  let max = 0;
  for (const f of files) {
    const m = f.match(/^adv-(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `adv-${String(max + 1).padStart(3, '0')}`;
}

function sampleCorpusAttack() {
  if (!existsSync(CORPUS_ATTACKS)) return null;
  const files = readdirSync(CORPUS_ATTACKS).filter((f) => f.endsWith('.json'));
  if (!files.length) return null;
  const pick = files[Math.floor(Math.random() * files.length)];
  return JSON.parse(readFileSync(join(CORPUS_ATTACKS, pick), 'utf-8'));
}

/** Build mutation from bypass report entry */
function fixtureFromBypass(bypass, seed) {
  const base = seed || sampleCorpusAttack() || {
    toolName: 'search',
    arguments: { content: 'ignore previous instructions' },
  };
  const id = nextAdvId();
  const toolName = bypass.toolName || base.toolName || base.tool || 'search';
  const args = bypass.arguments || base.arguments || base.args || { content: bypass.payload || 'bypass probe' };
  return {
    id,
    category: bypass.category || 'swarm-generated',
    toolName,
    arguments: args,
    expectedBlock: true,
    ruleHint: bypass.ruleHint || bypass.expectedRule || 'swarm-evasion',
    source: 'security-swarm/evasion-generate',
    parentBypass: bypass.id || bypass.fixtureId,
  };
}

const bypassSources = [
  loadJson(join(OUT_DIR, 'bypasses.json')),
  loadJson(join(REPO, 'adversarial-harness', 'reports', 'comprehensive-eval.json')),
  loadJson(join(REPO, 'adversarial-harness', 'reports', 'parity-report.json')),
];

const bypasses = [];
for (const src of bypassSources) {
  if (!src) continue;
  if (Array.isArray(src.bypasses)) bypasses.push(...src.bypasses);
  if (Array.isArray(src.failures)) {
    for (const f of src.failures) {
      if (f.expected === 'block' && f.actual === 'allow') bypasses.push(f);
    }
  }
  if (Array.isArray(src.mismatches)) {
    for (const m of src.mismatches) {
      if (m.node === 'allow' || m.python === 'block') bypasses.push({ ...m, category: 'parity-mismatch' });
    }
  }
}

const promotions = [];
const seed = sampleCorpusAttack();

if (bypasses.length === 0) {
  console.log('[evasion-generate] No bypasses in reports — nothing to promote');
  writeFileSync(MANIFEST, JSON.stringify({ generated: [], note: 'no bypasses' }, null, 2));
  process.exit(0);
}

for (const b of bypasses.slice(0, 20)) {
  const fx = fixtureFromBypass(b, seed);
  const path = join(CUSTOM, `${fx.id}.json`);
  writeFileSync(path, JSON.stringify(fx, null, 2));
  promotions.push({ id: fx.id, path: `adversarial-harness/fixtures/custom-attacks/${fx.id}.json`, branch: `swarm/corpus-${fx.id}` });
  console.log(`[evasion-generate] wrote ${fx.id}`);
}

writeFileSync(
  MANIFEST,
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      count: promotions.length,
      promotions,
      instructions: 'Open PR from branch swarm/corpus-adv-NNN; require corpus+parity pass before merge.',
    },
    null,
    2,
  ),
);

process.exit(0);
