#!/usr/bin/env node
/**
 * Report agent — merge swarm step outputs into reports/security-swarm/latest.json + summary.md
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const OUT_DIR = join(REPO, 'reports', 'security-swarm');

function load(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function synthesizeReport(input) {
  const { steps = [], mode = 'full', gates = {} } = input;
  const scout = load(join(OUT_DIR, 'scout.json'));
  const corpus = load(join(REPO, 'corpus-eval-report.json'));
  const parity = load(join(REPO, 'adversarial-harness', 'reports', 'parity-report.json'));
  const harness = load(join(REPO, 'adversarial-harness', 'reports', 'harness-summary.json'));
  const promotions = load(join(OUT_DIR, 'evasion-promotions.json'));

  let commitSha = 'unknown';
  try {
    commitSha = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf-8' }).trim();
  } catch {
    /* ignore */
  }

  const corpusFn = corpus?.overall?.fn ?? corpus?.failures?.length ?? 1;
  const corpusFp = corpus?.overall?.fp ?? 1;
  const attackBlockRate =
    corpus?.attackBlockRate ??
    (corpus?.overall?.recall != null ? corpus.overall.recall : undefined);
  const benignPassRate =
    corpus?.benignPassRate ??
    (corpus?.overall?.tn != null && corpus?.overall?.fp === 0 ? 1 : undefined);
  const corpusOk =
    corpus &&
    corpusFn === 0 &&
    corpusFp === 0 &&
    (corpus.totalEntries ?? 0) >= (gates.corpus?.minEntries ?? 228) &&
    (attackBlockRate ?? 1) >= (gates.corpus?.minAttackBlockRate ?? 1) &&
    (benignPassRate ?? 1) >= 1 - (gates.corpus?.maxBenignFalsePositiveRate ?? 0);
  const parityOk =
    parity &&
    (parity.corpusMismatches?.length ?? 0) === 0 &&
    (parity.agreementRate ?? 0) >= (gates.parity?.minOverallAgreementRate ?? 0.97);
  const stepsOk = steps.every((s) => s.ok !== false);

  const bypasses = [];
  if (parity?.mismatches) {
    for (const m of parity.mismatches) {
      if (m.node === 'allow' || m.python === 'block') bypasses.push(m);
    }
  }
  if (harness?.comprehensive?.failures) {
    for (const f of harness.comprehensive.failures) {
      if (f.expected === 'block') bypasses.push(f);
    }
  }

  writeFileSync(join(OUT_DIR, 'bypasses.json'), JSON.stringify({ bypasses, count: bypasses.length }, null, 2));

  const latest = {
    version: 1,
    mode,
    timestamp: new Date().toISOString(),
    commitSha,
    gates: {
      corpus: corpusOk,
      parity: parityOk,
      steps: stepsOk,
      scout: scout?.audit?.ok ?? true,
      bypassCount: bypasses.length,
      maxBypasses: gates.evasion?.maxBypasses ?? 0,
    },
    overall: corpusOk && parityOk && stepsOk && bypasses.length <= (gates.evasion?.maxBypasses ?? 0),
    steps,
    scout,
    corpus: corpus
      ? {
          totalEntries: corpus.totalEntries,
          fn: corpus.overall?.fn ?? 0,
          fp: corpus.overall?.fp ?? 0,
          attackBlockRate: attackBlockRate ?? corpus.overall?.recall,
          benignPassRate: benignPassRate ?? (corpus.overall?.fp === 0 ? 1 : 0),
        }
      : null,
    parity: parity
      ? {
          agreement: parity.agreement,
          total: parity.total,
          agreementRate: parity.agreementRate,
          corpusMismatches: parity.corpusMismatches?.length ?? 0,
        }
      : null,
    harness: harness ? { allOk: harness.allOk } : null,
    evasionPromotions: promotions?.count ?? 0,
    recommendedEnvProfile: bypasses.length > 0 ? 'high-paranoia' : 'hybrid',
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'latest.json'), JSON.stringify(latest, null, 2));

  const md = `# Security Swarm Report

Generated: ${latest.timestamp}  
Commit: \`${commitSha}\`  
Mode: **${mode}**  
Overall: **${latest.overall ? 'PASS' : 'FAIL'}**

## Gates

| Gate | Status |
|------|--------|
| Corpus (${corpus?.totalEntries ?? '?'} entries) | ${corpusOk ? 'PASS' : 'FAIL'} |
| Parity (corpus 100%) | ${parityOk ? 'PASS' : 'FAIL'} |
| Steps | ${stepsOk ? 'PASS' : 'FAIL'} |
| Bypasses (max ${gates.evasion?.maxBypasses ?? 0}) | ${bypasses.length} |
| Scout audit | ${scout?.audit?.ok !== false ? 'PASS' : 'FAIL'} |

## Recommended runtime profile

\`${latest.recommendedEnvProfile}\` — see [docs/AI_LEARNING.md](../docs/AI_LEARNING.md#deployment-profiles-security-swarm).

## Steps

${steps.map((s) => `- **${s.label}**: ${s.ok ? 'OK' : 'FAIL'} (exit ${s.status ?? '?'})`).join('\n')}

## Bypasses

${bypasses.length === 0 ? '_None detected._' : bypasses.map((b) => `- ${b.id || b.fixtureId || JSON.stringify(b).slice(0, 80)}`).join('\n')}

## Evidence links

- [enterprise-findings-fixes/summary.md](enterprise-findings-fixes/summary.md)
- [adversarial-harness/reports/harness-summary.md](../../adversarial-harness/reports/harness-summary.md)
`;

  writeFileSync(join(OUT_DIR, 'summary.md'), md);
  return latest;
}

// CLI when run directly: node security-swarm/agents/report-synthesize.mjs
const isMain = process.argv[1]?.endsWith('report-synthesize.mjs');
if (isMain) {
  const stepsData = load(join(OUT_DIR, 'steps.json'));
  const steps = stepsData?.steps || [];
  const gates = JSON.parse(readFileSync(join(__dir, '..', 'config', 'gates.json'), 'utf-8'));
  const latest = synthesizeReport({ steps, mode: process.env.SWARM_MODE || 'full', gates });
  console.log(`[report] overall=${latest.overall} → reports/security-swarm/latest.json`);
  process.exit(latest.overall ? 0 : 1);
}
