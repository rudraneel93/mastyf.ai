import type { ThreatSignature } from './fleet-threat-signatures.js';

export interface FederatedSignatureProvenance {
  sourceRegion: string;
  firstSeenAt: string;
  lastSeenAt: string;
  evidenceCount: number;
  confidence: number;
}

export interface FederatedSignatureShareRecord {
  signatureId: string;
  rule: string;
  tool: string;
  category: string;
  argShapeHash: string;
  provenance: FederatedSignatureProvenance;
  decayWeight: number;
  compatibilityWeight: number;
  finalWeight: number;
}

export interface CompatibilityContext {
  region?: string;
  toolUsageSet: Set<string>;
  categoryUsageSet: Set<string>;
}

export function computeDecayWeight(lastSeenAt: string, halfLifeDays = 30): number {
  const ageMs = Math.max(0, Date.now() - Date.parse(lastSeenAt));
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const decay = Math.pow(0.5, ageDays / Math.max(1, halfLifeDays));
  return Math.max(0.1, Math.min(1, decay));
}

export function computeCompatibilityWeight(
  sig: Pick<ThreatSignature, 'tool' | 'category'>,
  ctx: CompatibilityContext,
): number {
  let score = 0.3;
  if (ctx.toolUsageSet.has(sig.tool)) score += 0.45;
  if (ctx.categoryUsageSet.has(sig.category)) score += 0.25;
  return Math.max(0.1, Math.min(1, score));
}

export function buildFederatedShareRecords(
  signatures: ThreatSignature[],
  provenanceById: Record<string, FederatedSignatureProvenance>,
  ctx: CompatibilityContext,
): FederatedSignatureShareRecord[] {
  return signatures.map((sig) => {
    const provenance = provenanceById[sig.signatureId] ?? {
      sourceRegion: ctx.region || 'unknown',
      firstSeenAt: sig.lastSeen,
      lastSeenAt: sig.lastSeen,
      evidenceCount: sig.count,
      confidence: 0.5,
    };
    const decayWeight = computeDecayWeight(provenance.lastSeenAt);
    const compatibilityWeight = computeCompatibilityWeight(sig, ctx);
    const confidenceWeight = Math.max(0.1, Math.min(1, provenance.confidence));
    const finalWeight = Math.round((decayWeight * 0.35 + compatibilityWeight * 0.4 + confidenceWeight * 0.25) * 1000) / 1000;
    return {
      signatureId: sig.signatureId,
      rule: sig.rule,
      tool: sig.tool,
      category: sig.category,
      argShapeHash: sig.argShapeHash,
      provenance,
      decayWeight: Math.round(decayWeight * 1000) / 1000,
      compatibilityWeight: Math.round(compatibilityWeight * 1000) / 1000,
      finalWeight,
    };
  }).sort((a, b) => b.finalWeight - a.finalWeight);
}
