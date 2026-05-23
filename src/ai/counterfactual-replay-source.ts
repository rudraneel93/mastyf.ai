/**
 * Resolve replay arguments for counterfactual simulation from stored audits + corpus.
 */
import type { StoredSemanticAudit } from './semantic-audit-store.js';
import { loadCorpusSamples } from './threat-lab.js';

export type ReplaySample = {
  id: string;
  serverName: string;
  toolName: string;
  arguments: Record<string, unknown>;
  source: 'stored_args' | 'corpus_match' | 'empty';
};

function corpusMatchForRecord(rec: StoredSemanticAudit): Record<string, unknown> | null {
  const cat = rec.semanticAudit?.categories?.[0];
  const samples = loadCorpusSamples({
    category: cat && cat !== 'none' ? cat : undefined,
    limit: 200,
  });
  const exact = samples.find((s) => s.toolName === rec.toolName);
  if (exact) return exact.arguments;
  const partial = samples.find((s) => {
    const a = rec.toolName.toLowerCase();
    const b = s.toolName.toLowerCase();
    return a.includes(b) || b.includes(a);
  });
  return partial?.arguments ?? null;
}

export function resolveReplaySample(rec: StoredSemanticAudit): ReplaySample {
  if (rec.argumentsSnapshot && Object.keys(rec.argumentsSnapshot).length) {
    return {
      id: rec.id,
      serverName: rec.serverName,
      toolName: rec.toolName,
      arguments: rec.argumentsSnapshot,
      source: 'stored_args',
    };
  }
  const corpusArgs = corpusMatchForRecord(rec);
  if (corpusArgs) {
    return {
      id: rec.id,
      serverName: rec.serverName,
      toolName: rec.toolName,
      arguments: corpusArgs,
      source: 'corpus_match',
    };
  }
  return {
    id: rec.id,
    serverName: rec.serverName,
    toolName: rec.toolName,
    arguments: {},
    source: 'empty',
  };
}

export function summarizeReplaySources(samples: ReplaySample[]): {
  storedArgs: number;
  corpusMatch: number;
  empty: number;
} {
  return {
    storedArgs: samples.filter((s) => s.source === 'stored_args').length,
    corpusMatch: samples.filter((s) => s.source === 'corpus_match').length,
    empty: samples.filter((s) => s.source === 'empty').length,
  };
}
