#!/usr/bin/env node
/**
 * Security Swarm orchestrator — CI + research DAG over adversarial harness, corpus, vitest.
 * Usage: node security-swarm/run.mjs [--fast]
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesizeReport } from './agents/report-synthesize.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..');
const OUT_DIR = join(REPO, 'reports', 'security-swarm');
const FAST = process.argv.includes('--fast');

const gates = JSON.parse(readFileSync(join(__dir, 'config', 'gates.json'), 'utf-8'));
const steps = [];

function run(cmd, args, opts = {}) {
  const label = opts.label ?? [cmd, ...args].join(' ');
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? REPO,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GUARDIAN_DISABLE_SEMANTIC: opts.semanticOff ? 'true' : process.env.GUARDIAN_DISABLE_SEMANTIC || '',
      GUARDIAN_POLICY_TIMING_ENVELOPE: process.env.GUARDIAN_POLICY_TIMING_ENVELOPE ?? 'false',
      ...opts.env,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const step = {
    label,
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout || '').slice(0, 4000),
    stderr: (r.stderr || '').slice(0, 1500),
  };
  steps.push(step);
  if (!step.ok) console.error(step.stderr);
  return r;
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`Security Swarm — mode: ${FAST ? 'fast (PR)' : 'full (nightly)'}`);

run('node', ['security-swarm/agents/scout.mjs'], { label: 'scout-audit', semanticOff: true });

run('pnpm', ['build'], { label: 'pnpm-build' });

run('pnpm', ['test:policy-proxy-utils'], { label: 'vitest-policy-proxy-utils' });

run('pnpm', ['exec', 'tsx', 'corpus/run-eval.ts'], {
  label: 'corpus-eval',
  env: { GUARDIAN_DISABLE_SEMANTIC: 'true' },
});

if (!FAST) {
  run('node', ['adversarial-harness/run-harness.mjs'], { label: 'adversarial-harness-full' });
  run('pnpm', ['eval:attack-learning'], { label: 'attack-learning-sim', semanticOff: true });
} else {
  const venvSetup = run('node', ['adversarial-harness/scripts/setup-python-venv.mjs'], {
    label: 'setup-python-venv',
  });
  const venvPython = (venvSetup.stdout || '').trim() || 'python3';
  run('node', ['adversarial-harness/scripts/run-node-tests.mjs'], { label: 'harness-node-tests' });
  run('pnpm', ['exec', 'tsx', 'adversarial-harness/scripts/compare-node-python.ts'], {
    label: 'harness-parity',
    env: {
      GUARDIAN_DISABLE_SEMANTIC: 'true',
      PYTHONPATH: join(REPO, 'adversarial-harness', 'python'),
      HARNESS_PYTHON: venvPython,
    },
  });
}

writeFileSync(join(OUT_DIR, 'steps.json'), JSON.stringify({ steps, mode: FAST ? 'fast' : 'full' }, null, 2));

const latest = synthesizeReport({ steps, mode: FAST ? 'fast' : 'full', gates });

if (!latest.overall && existsSync(join(OUT_DIR, 'bypasses.json'))) {
  const bypassData = JSON.parse(readFileSync(join(OUT_DIR, 'bypasses.json'), 'utf-8'));
  if ((bypassData.count ?? 0) > 0) {
    run('node', ['security-swarm/agents/evasion-generate.mjs'], { label: 'evasion-generate' });
    synthesizeReport({ steps, mode: FAST ? 'fast' : 'full', gates });
  }
}

console.log(`\nReport: ${join(OUT_DIR, 'summary.md')}`);
process.exit(latest.overall ? 0 : 1);
