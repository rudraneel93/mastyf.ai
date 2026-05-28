import type { ProxyCallRecord } from '../types.js';
import type { AutopilotStatus } from '../utils/autopilot-status.js';
import type { SimilarEnvironmentBenchmark } from './similar-environment-benchmarks.js';

export interface ContinuousAssuranceReport {
  generatedAt: string;
  tenantId: string;
  controls: {
    trafficProtected: boolean;
    llmReachable: boolean;
    pendingSuggestions: number;
    threatResearchQueue: number;
  };
  metrics: {
    totalCalls: number;
    blockedCalls: number;
    blockedRate: number;
    avgLatencyMs: number;
  };
  benchmarkSummary: {
    servers: number;
    needsAttention: number;
    outperforming: number;
  };
  attestations: string[];
}

export function buildContinuousAssuranceReport(input: {
  tenantId: string;
  records: ProxyCallRecord[];
  autopilot: AutopilotStatus;
  benchmarks: SimilarEnvironmentBenchmark[];
}): ContinuousAssuranceReport {
  const totalCalls = input.records.length;
  const blockedCalls = input.records.filter((r) => !!r.blocked).length;
  const avgLatencyMs = totalCalls > 0
    ? input.records.reduce((s, r) => s + (r.durationMs || 0), 0) / totalCalls
    : 0;
  const needsAttention = input.benchmarks.filter((b) => b.status === 'needs_attention').length;
  const outperforming = input.benchmarks.filter((b) => b.status === 'outperforming').length;
  const blockedRate = totalCalls > 0 ? blockedCalls / totalCalls : 0;
  const attestations: string[] = [];
  attestations.push(input.autopilot.llm.ok ? 'LLM health check passing' : 'LLM health check failing');
  attestations.push(
    input.autopilot.protection.historyDbAttached
      ? 'Runtime audit trail attached to active history DB'
      : 'Runtime audit trail unavailable',
  );
  attestations.push(
    input.autopilot.learning.pendingSuggestions > 0
      ? 'Human approval queue has pending changes'
      : 'No pending policy suggestions in queue',
  );
  return {
    generatedAt: new Date().toISOString(),
    tenantId: input.tenantId,
    controls: {
      trafficProtected: input.autopilot.protection.historyDbAttached,
      llmReachable: input.autopilot.llm.ok,
      pendingSuggestions: input.autopilot.learning.pendingSuggestions,
      threatResearchQueue: input.autopilot.learning.threatResearchQueue.queued,
    },
    metrics: {
      totalCalls,
      blockedCalls,
      blockedRate: Math.round(blockedRate * 1000) / 1000,
      avgLatencyMs: Math.round(avgLatencyMs),
    },
    benchmarkSummary: {
      servers: input.benchmarks.length,
      needsAttention,
      outperforming,
    },
    attestations,
  };
}
