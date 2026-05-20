#!/usr/bin/env node
/**
 * Comprehensive adversarial test harness orchestrator.
 * 1. Export rules  2. Generate custom attacks  3. Python eval  4. Node tests  5. Parity  6. Report
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = join(__dir, 'reports');
const SUMMARY = join(REPORT_DIR, 'harness-summary.md');

const steps = [];

function run(cmd, args, opts = {}) {
  const label = opts.label ?? [cmd, ...args].join(' ');
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? join(__dir, '..'),
    encoding: 'utf-8',
    env: { ...process.env, ...opts.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  steps.push({
    label,
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout || '').slice(0, 4000),
    stderr: (r.stderr || '').slice(0, 2000),
  });
  return r;
}

function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

mkdirSync(REPORT_DIR, { recursive: true });

console.log('=== Adversarial Harness ===\n');

// 1. Export rules
run('pnpm', ['exec', 'tsx', 'adversarial-harness/scripts/export-harness-rules.ts'], {
  label: 'export-harness-rules',
});

// 2. Generate custom attacks
run('node', ['adversarial-harness/scripts/generate-custom-attacks.mjs'], {
  label: 'generate-custom-attacks',
});

// 3. Python corpus + custom eval
run(
  'python3',
  ['-m', 'pip', 'install', '-q', '-r', 'adversarial-harness/python/requirements.txt'],
  { label: 'pip-install' },
);
const py = run('python3', ['adversarial-harness/python/run_eval.py'], {
  label: 'python-eval',
  cwd: join(__dir, '..'),
  env: { PYTHONPATH: join(__dir, 'python') },
});

// 4. Node harness tests (vitest)
run('pnpm', ['build'], { label: 'pnpm-build' });
const vitestArgs = [
  'exec',
  'vitest',
  'run',
  'adversarial-harness/node/async-queue.test.mjs',
  'adversarial-harness/node/streaming-race.test.mjs',
  'adversarial-harness/node/secret-scanner.test.mjs',
  'adversarial-harness/node/proxy-pipeline.test.mjs',
];
run('pnpm', vitestArgs, { label: 'node-harness-tests' });

// 5. Node corpus eval (canonical)
run('pnpm', ['exec', 'tsx', 'corpus/run-eval.ts'], { label: 'node-corpus-eval' });

// 6. Parity
const parity = run(
  'pnpm',
  ['exec', 'tsx', 'adversarial-harness/scripts/compare-node-python.ts'],
  {
    label: 'node-python-parity',
    env: { PYTHONPATH: join(__dir, 'python') },
  },
);

const pyReport = loadJson(join(REPORT_DIR, 'python-eval.json'));
const parityReport = loadJson(join(REPORT_DIR, 'parity-report.json'));
const corpusReport = loadJson(join(__dir, '..', 'corpus-eval-report.json'));

  const required = ['export-harness-rules', 'generate-custom-attacks', 'python-eval', 'node-corpus-eval', 'node-python-parity'];
  const allOk = required.every((name) => steps.find((s) => s.label === name)?.ok);

const md = `# Adversarial Harness Report

Generated: ${new Date().toISOString()}

## Summary

| Check | Status |
|-------|--------|
| Overall | ${allOk ? 'PASS' : 'FAIL'} |

## Steps

${steps
  .map(
    (s) => `### ${s.label}
- Status: ${s.ok ? 'OK' : 'FAIL'} (exit ${s.status})
${s.stderr ? `\n\`\`\`\n${s.stderr.trim()}\n\`\`\`\n` : ''}`,
  )
  .join('\n')}

## Python Policy Engine

${pyReport ? `- Entries: ${pyReport.totalEntries}\n- Passed: ${pyReport.passed}\n- F1: ${(pyReport.overall.f1 * 100).toFixed(1)}%\n- Failures: ${pyReport.failures.length}` : '_No report_'}

## Node Corpus Eval

${corpusReport ? `- Entries: ${corpusReport.totalEntries}\n- Passed: ${corpusReport.passed}\n- Attack block rate: ${(corpusReport.attackBlockRate * 100).toFixed(1)}%` : '_No report_'}

## Node ↔ Python Parity

${parityReport ? `- Agreement: ${parityReport.agreement}/${parityReport.total} (${(parityReport.agreementRate * 100).toFixed(1)}%)\n- Mismatches: ${parityReport.mismatches.length}` : '_No report_'}

## Coverage

- Corpus: 151 attacks + 55 benign fixtures
- Custom adversarial: 85+ evasion-focused probes
- Node: AsyncSerialQueue, streaming chunk races, secret scanner, mock MCP + proxy pipeline
- Python: faithful sync policy pipeline (prompt injection, semantic guards, YAML rules)
`;

writeFileSync(SUMMARY, md);
writeFileSync(
  join(REPORT_DIR, 'harness-summary.json'),
  JSON.stringify({ steps, pyReport, parityReport, corpusReport, allOk }, null, 2),
);

console.log(`\nReport: ${SUMMARY}`);
process.exit(allOk ? 0 : 1);
