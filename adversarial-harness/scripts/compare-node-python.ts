#!/usr/bin/env tsx
/**
 * Parity check: Python PolicyEngine vs Node PolicyEngine on corpus + custom fixtures.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { load } from 'js-yaml';
import { PolicyEngine } from '../../src/policy/policy-engine.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const REPO = join(__dir, '../..');
const CORPUS = join(REPO, 'corpus');
const CUSTOM = join(ROOT, 'fixtures', 'custom-attacks');
const REPORT = join(ROOT, 'reports', 'parity-report.json');

function loadJsonFixtures(dir: string, base: string) {
  const out: { rel: string; entry: Record<string, unknown> }[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...loadJsonFixtures(full, base));
    } else if (name.endsWith('.json')) {
      const rel = relative(base, full);
      const entry = JSON.parse(readFileSync(full, 'utf-8')) as Record<string, unknown>;
      out.push({ rel, entry });
    }
  }
  return out;
}

function nodeBlocked(
  engine: PolicyEngine,
  entry: Record<string, unknown>,
  rel: string,
): boolean {
  const decision = engine.evaluate({
    serverName: 'parity',
    toolName: entry.toolName as string,
    arguments: (entry.arguments as Record<string, unknown>) ?? {},
    requestId: 'parity-1',
    requestTokens: 50,
    timestamp: new Date().toISOString(),
    sessionId: `parity:${rel}`,
  });
  return decision.action === 'block';
}

function main() {
  const policy = load(readFileSync(join(REPO, 'default-policy.yaml'), 'utf-8'));
  const engine = new PolicyEngine(policy);

  const fixtures = [
    ...loadJsonFixtures(CORPUS, CORPUS),
    ...loadJsonFixtures(CUSTOM, CUSTOM),
  ];

  const pyInput = fixtures.map(({ rel, entry }) => ({
    rel,
    toolName: entry.toolName,
    arguments: entry.arguments ?? {},
    expected: entry.expected,
  }));

  const pyScript = join(ROOT, 'python', 'parity_batch.py');
  const py = spawnSync('python3', [pyScript], {
    input: JSON.stringify(pyInput),
    encoding: 'utf-8',
    cwd: join(ROOT, 'python'),
    env: { ...process.env, PYTHONPATH: join(ROOT, 'python') },
  });

  if (py.status !== 0) {
    console.error(py.stderr || py.stdout);
    process.exit(1);
  }

  const pyResults = JSON.parse(py.stdout) as { rel: string; blocked: boolean; rule: string }[];
  const mismatches: {
    rel: string;
    expected: unknown;
    nodeBlocked: boolean;
    pythonBlocked: boolean;
    pythonRule?: string;
  }[] = [];
  let agree = 0;

  for (const { rel, entry } of fixtures) {
    const nb = nodeBlocked(engine, entry, rel);
    const pr = pyResults.find((r) => r.rel === rel);
    const pb = pr?.blocked ?? false;
    if (nb === pb) agree++;
    else {
      mismatches.push({
        rel,
        expected: entry.expected,
        nodeBlocked: nb,
        pythonBlocked: pb,
        pythonRule: pr?.rule,
      });
    }
  }

  const corpusFixtures = fixtures.filter((f) => f.rel.startsWith('attacks/') || f.rel.startsWith('benign/') || f.rel.startsWith('edge-cases/'));
  const corpusMismatches = mismatches.filter((m) =>
    corpusFixtures.some((f) => f.rel === m.rel),
  );

  const report = {
    timestamp: new Date().toISOString(),
    total: fixtures.length,
    corpusTotal: corpusFixtures.length,
    agreement: agree,
    agreementRate: fixtures.length ? agree / fixtures.length : 1,
    mismatches,
    corpusMismatches,
    passed: corpusMismatches.length === 0,
    customMismatches: mismatches.length - corpusMismatches.length,
  };

  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(
    `Parity: ${agree}/${fixtures.length} (${(report.agreementRate * 100).toFixed(1)}%) mismatches=${mismatches.length}`,
  );
  if (mismatches.length) {
    console.log(
      mismatches
        .slice(0, 15)
        .map((m) => `${m.rel} node=${m.nodeBlocked} py=${m.pythonBlocked} (${m.pythonRule})`)
        .join('\n'),
    );
  }
  process.exit(report.passed ? 0 : 1);
}

main();
