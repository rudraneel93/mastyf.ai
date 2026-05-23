#!/usr/bin/env npx tsx
/**
 * Threat Lab runner — LLM discovery from authentic inputs → validate → signed manifest + adv fixtures.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHmac } from 'crypto';
import { exitUnlessProFeature } from '../../src/license/enforce-pro.js';
import {
  discoverFromBypass,
  discoverFromSemanticAudit,
  discoverFromThreatIntel,
  discoverFromCorpusSeed,
  validateThreatLabDiscovery,
  threatLabMaxCandidates,
  threatLabMode,
  threatLabRequireLlm,
  threatLabSemanticEnabled,
  ensureThreatLabLlmReady,
  loadCorpusSamples,
  isAuthenticSemanticTp,
  type ThreatLabDiscovery,
  type ThreatLabCandidateProvenance,
} from '../../src/ai/threat-lab.js';
import { candidateFingerprint, nextAdvId } from '../../src/ai/auto-corpus-writer.js';
import { autoThreatResearchOwnsAdvWrites } from '../../src/ai/threat-research-pipeline.js';
import { loadSemanticAuditRecordsAsync } from '../../src/ai/semantic-audit-store.js';
import { getSharedThreatIntel } from '../../src/ai/threat-intel.js';

await exitUnlessProFeature('swarm');

const REPO = process.cwd();
const OUT_DIR = join(REPO, 'reports', 'security-swarm');
const MANIFEST = join(OUT_DIR, 'threat-lab-candidates.json');
const CUSTOM = join(REPO, 'adversarial-harness', 'fixtures', 'custom-attacks');
const GATES_PATH = join(REPO, 'security-swarm', 'config', 'gates.json');

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(CUSTOM, { recursive: true });

type QueuedCandidate = {
  id: string;
  fingerprint: string;
  attackClass: string;
  hypothesis: string;
  confidence: number;
  provenance: ThreatLabCandidateProvenance;
  validation: { ok: boolean; errors: string[]; replayBlocked?: boolean };
  path?: string;
  branch?: string;
  policyRule: ThreatLabDiscovery['policyRule'];
  corpusCandidate: ThreatLabDiscovery['corpusCandidate'];
  advWriteSkipped?: string;
};

function loadJson(path: string): unknown {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function signManifest(
  manifest: Record<string, unknown>,
  promotions: Array<{ id: string; path?: string; branch?: string; fingerprint: string }>,
): Record<string, unknown> {
  const key =
    process.env.GUARDIAN_SWARM_EVASION_SIGNING_KEY?.trim() ||
    process.env.SWARM_SIGNER_KEY?.trim() ||
    '';
  const signedBody = {
    promotions,
    timestamp: manifest.timestamp,
    count: manifest.count,
    instructions: manifest.instructions,
  };
  if (!key) return { ...manifest, promotions, signature: null, signed: false };
  const payload = JSON.stringify(signedBody);
  const signature = createHmac('sha256', key).update(payload).digest('hex');
  return {
    ...manifest,
    promotions,
    signature,
    signed: true,
    signer: 'guardian-threat-lab',
    signedAt: new Date().toISOString(),
  };
}

function collectBypasses(): Record<string, unknown>[] {
  const bypassSources = [
    loadJson(join(OUT_DIR, 'bypasses.json')),
    loadJson(join(REPO, 'adversarial-harness', 'reports', 'comprehensive-eval.json')),
    loadJson(join(REPO, 'adversarial-harness', 'reports', 'parity-report.json')),
  ];
  const bypasses: Record<string, unknown>[] = [];
  for (const src of bypassSources) {
    if (!src || typeof src !== 'object') continue;
    const s = src as Record<string, unknown>;
    const list = (s.bypasses || s.items) as unknown[];
    if (Array.isArray(list)) {
      for (const b of list) {
        if (b && typeof b === 'object' && (b as { _netNew?: boolean })._netNew !== false) {
          bypasses.push(b as Record<string, unknown>);
        }
      }
    }
    const failures = s.failures as unknown[];
    if (Array.isArray(failures)) {
      for (const f of failures) {
        if (
          f &&
          typeof f === 'object' &&
          (f as { expected?: string; actual?: string }).expected === 'block' &&
          (f as { actual?: string }).actual === 'allow'
        ) {
          bypasses.push(f as Record<string, unknown>);
        }
      }
    }
    const mismatches = s.mismatches as unknown[];
    if (Array.isArray(mismatches)) {
      for (const m of mismatches) {
        if (
          m &&
          typeof m === 'object' &&
          ((m as { node?: string }).node === 'allow' || (m as { python?: string }).python === 'block')
        ) {
          bypasses.push({ ...(m as Record<string, unknown>), category: 'parity-mismatch' });
        }
      }
    }
  }
  return bypasses;
}

function writeAdvFixture(
  discovery: ThreatLabDiscovery,
  source: string,
): { advId: string; relPath: string } {
  const advId = nextAdvId(CUSTOM);
  const fixture = {
    ...discovery.corpusCandidate,
    id: advId,
    expectedBlock: true,
    expected: 'block',
    source,
  };
  const relPath = `adversarial-harness/fixtures/custom-attacks/${advId}.json`;
  writeFileSync(join(REPO, relPath), JSON.stringify(fixture, null, 2));
  return { advId, relPath };
}

function queueCandidate(
  candidates: QueuedCandidate[],
  seen: Set<string>,
  discovery: ThreatLabDiscovery,
  provenance: ThreatLabCandidateProvenance,
  requireReplay: boolean,
  fixtureSource: string,
): boolean {
  const fp = candidateFingerprint(discovery);
  if (seen.has(fp)) return false;
  const validation = validateThreatLabDiscovery(discovery, { requireReplayBlock: requireReplay });
  if (!validation.ok) {
    console.log(`[threat-lab] reject ${discovery.attackClass}: ${validation.errors.join('; ')}`);
    return false;
  }
  seen.add(fp);
  let advId: string;
  let relPath: string | undefined;
  if (autoThreatResearchOwnsAdvWrites()) {
    advId = `threat-lab-${String(candidates.length + 1).padStart(3, '0')}`;
    relPath = undefined;
    console.log(
      `[threat-lab] audit-only ${advId} (${discovery.attackClass}) — adv writes owned by auto-threat-research`,
    );
  } else {
    const written = writeAdvFixture(discovery, fixtureSource);
    advId = written.advId;
    relPath = written.relPath;
    console.log(`[threat-lab] queued ${advId} (${discovery.attackClass}, source=${provenance.source})`);
  }
  candidates.push({
    id: advId,
    fingerprint: fp,
    attackClass: discovery.attackClass,
    hypothesis: discovery.hypothesis,
    confidence: discovery.confidence,
    provenance,
    validation,
    path: relPath,
    branch: relPath ? `swarm/threat-lab-${advId}` : undefined,
    policyRule: discovery.policyRule,
    corpusCandidate: discovery.corpusCandidate,
    advWriteSkipped: autoThreatResearchOwnsAdvWrites() ? 'auto-threat-research' : undefined,
  });
  return true;
}

async function main(): Promise<void> {
  const max = threatLabMaxCandidates();
  const mode = threatLabMode();
  const requireReplay = process.env.SWARM_THREAT_LAB_REQUIRE_REPLAY !== 'false';

  const llmReady = await ensureThreatLabLlmReady();
  if (!llmReady.ok) {
    const msg = `[threat-lab] skipped: ${llmReady.reason}`;
    if (threatLabRequireLlm()) {
      console.log(msg);
      process.exit(0);
    }
    console.error(msg);
    process.exit(1);
  }
  const llm = llmReady.llm;

  const candidates: QueuedCandidate[] = [];
  const seen = new Set<string>();
  let seq = 1;

  const bypasses = collectBypasses();
  if (mode === 'reactive' && bypasses.length === 0) {
    console.log('[threat-lab] reactive mode: no authentic bypasses — skipping');
    writeFileSync(
      MANIFEST,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          count: 0,
          mode,
          llmModel: llm.getModel(),
          skipped: 'no bypasses in reactive mode',
          candidates: [],
          promotions: [],
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  for (const b of bypasses.slice(0, max)) {
    if (candidates.length >= max) break;
    const discovery = await discoverFromBypass(b as Parameters<typeof discoverFromBypass>[0], { llm, seq });
    if (!discovery) continue;
    queueCandidate(
      candidates,
      seen,
      discovery,
      {
        source: 'bypass',
        llmUsed: true,
        inputFingerprint: String((b as { fingerprint?: string }).fingerprint || ''),
      },
      requireReplay,
      'security-swarm/threat-lab',
    );
    seq++;
  }

  if (candidates.length < max && threatLabSemanticEnabled()) {
    const records = await loadSemanticAuditRecordsAsync({ sinceMs: 7 * 24 * 60 * 60 * 1000, limit: 50 });
    const tps = records.filter(isAuthenticSemanticTp);
    for (const rec of tps) {
      if (candidates.length >= max) break;
      const discovery = await discoverFromSemanticAudit(rec, { llm, seq });
      if (!discovery) continue;
      queueCandidate(
        candidates,
        seen,
        discovery,
        { source: 'semantic-tp', llmUsed: true, inputFingerprint: rec.id },
        requireReplay,
        'threat-lab-semantic-tp',
      );
      seq++;
    }
  }

  if (candidates.length < max && process.env.SWARM_THREAT_LAB_THREAT_INTEL !== 'false') {
    const ti = getSharedThreatIntel();
    try {
      await ti.pollLiveFeeds();
    } catch (err) {
      console.log(`[threat-lab] ThreatIntel poll warning: ${err instanceof Error ? err.message : String(err)}`);
    }
    const entries = ti
      .getCatalogEntries({ minSeverity: 'MEDIUM', limit: max - candidates.length })
      .filter((e) => e.severity === 'CRITICAL' || e.severity === 'HIGH' || e.severity === 'MEDIUM');
    for (const entry of entries) {
      if (candidates.length >= max) break;
      const discovery = await discoverFromThreatIntel(entry, { llm, seq });
      if (!discovery) continue;
      queueCandidate(
        candidates,
        seen,
        discovery,
        { source: 'threat-intel', llmUsed: true, inputFingerprint: entry.id },
        requireReplay,
        'threat-lab-threat-intel',
      );
      seq++;
    }
  }

  if (mode === 'proactive' && candidates.length < max) {
    const seeds = loadCorpusSamples({ limit: max - candidates.length });
    for (const seed of seeds) {
      if (candidates.length >= max) break;
      const discovery = await discoverFromCorpusSeed(seed, { llm, seq });
      if (!discovery) continue;
      queueCandidate(
        candidates,
        seen,
        discovery,
        {
          source: 'corpus-proactive',
          llmUsed: true,
          corpusSeedId: seed.relPath,
        },
        requireReplay,
        'threat-lab-proactive',
      );
      seq++;
    }
  }

  const gates = existsSync(GATES_PATH)
    ? (JSON.parse(readFileSync(GATES_PATH, 'utf-8')) as {
        threatLab?: { maxFallbackCandidates?: number; minReplayBlockRate?: number };
      })
    : {};
  const maxFallback = gates.threatLab?.maxFallbackCandidates ?? 0;
  const fallbackCount = candidates.filter((c) => c.attackClass.startsWith('llm-fallback')).length;
  if (fallbackCount > maxFallback) {
    console.error(`[threat-lab] gate failed: ${fallbackCount} fallback candidate(s) (max ${maxFallback})`);
    process.exit(1);
  }

  const replayRate =
    candidates.length === 0
      ? 1
      : candidates.filter((c) => c.validation.replayBlocked).length / candidates.length;
  const minReplay = requireReplay ? (gates.threatLab?.minReplayBlockRate ?? 1) : 0;
  if (candidates.length > 0 && replayRate < minReplay) {
    console.error(`[threat-lab] gate failed: replay block rate ${replayRate} < ${minReplay}`);
    process.exit(1);
  }

  const manifest = signManifest(
    {
      timestamp: new Date().toISOString(),
      count: candidates.length,
      mode,
      llmModel: llm.getModel(),
      llmUsed: true,
      candidates,
      instructions:
        'Review via dashboard or: node security-swarm/scripts/open-corpus-pr.mjs. Human merge required — no auto-merge.',
    },
    candidates
      .filter((c) => c.path)
      .map((c) => ({
        id: c.id,
        path: c.path!,
        branch: c.branch || `swarm/threat-lab-${c.id}`,
        fingerprint: c.fingerprint,
      })),
  );

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`[threat-lab] wrote ${candidates.length} authentic LLM candidate(s) → ${MANIFEST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
