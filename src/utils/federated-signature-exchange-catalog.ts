/**
 * Catalog helpers for federated signature exchange (split for testability).
 */
import type { ThreatSignature } from './fleet-threat-signatures.js';

export type SignatureHint = {
  signatureId: string;
  rule: string;
  tool: string;
  category: string;
  instanceCount: number;
  totalCount: number;
  message: string;
  firstSeen?: string;
};

export type RemoteSignatureCatalog = {
  signatures: Array<{
    signatureId: string;
    rule: string;
    tool: string;
    category: string;
    argShapeHash: string;
    instanceCount: number;
    eventCount: number;
    lastSeen: string;
  }>;
};

export function buildSignatureHints(
  catalog: RemoteSignatureCatalog,
  localIds: Set<string>,
  minInstances = 2,
): SignatureHint[] {
  const hints: SignatureHint[] = [];
  for (const s of catalog.signatures) {
    if (s.instanceCount < minInstances) continue;
    const isNewLocally = !localIds.has(s.signatureId);
    hints.push({
      signatureId: s.signatureId,
      rule: s.rule,
      tool: s.tool,
      category: s.category,
      instanceCount: s.instanceCount,
      totalCount: s.eventCount,
      message: isNewLocally
        ? `${s.instanceCount} fleet instances saw ${s.tool}/${s.category} — not yet on this instance`
        : `${s.instanceCount} fleet instances also saw this pattern (${s.eventCount} events)`,
      firstSeen: s.lastSeen,
    });
  }
  return hints.sort((a, b) => b.totalCount - a.totalCount).slice(0, 50);
}

export function catalogFromFleetRows(
  rows: Array<{
    signature_id: string;
    rule_name: string;
    tool_name: string;
    category: string;
    arg_shape_hash: string;
    instance_count: number;
    event_count: number;
    last_seen: string | Date;
  }>,
): RemoteSignatureCatalog {
  return {
    signatures: rows.map((r) => ({
      signatureId: r.signature_id,
      rule: r.rule_name,
      tool: r.tool_name,
      category: r.category,
      argShapeHash: r.arg_shape_hash,
      instanceCount: r.instance_count,
      eventCount: r.event_count,
      lastSeen: String(r.last_seen),
    })),
  };
}

export type { ThreatSignature };
