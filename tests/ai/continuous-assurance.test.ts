import { describe, expect, it } from 'vitest';
import { buildContinuousAssuranceReport } from '../../src/ai/continuous-assurance.js';

describe('continuous assurance report', () => {
  it('builds assurance report from runtime controls', () => {
    const report = buildContinuousAssuranceReport({
      tenantId: 'default',
      records: [
        { serverName: 'fs', toolName: 'read_file', requestTokens: 10, responseTokens: 20, totalTokens: 30, durationMs: 50, timestamp: new Date().toISOString(), blocked: true },
        { serverName: 'fs', toolName: 'list_directory', requestTokens: 5, responseTokens: 5, totalTokens: 10, durationMs: 20, timestamp: new Date().toISOString(), blocked: false },
      ],
      autopilot: {
        timestamp: new Date().toISOString(),
        autopilotEnabled: true,
        config: null,
        license: { pro: true, swarm: true, ai: true, dashboard: true },
        protection: { historyDbAttached: true, policyAutoApply: false },
        learning: {
          aiEnabled: true,
          pendingSuggestions: 1,
          threatResearchEnabled: true,
          threatResearchQueue: {
            queued: 0,
            maxPerHour: 20,
            writesThisHour: 0,
            debounceMs: 5000,
            enabled: true,
            sources: { semantic: true, blocks: true, threatIntel: true },
          },
        },
        scheduler: {
          running: false,
          startedAt: null,
          stoppedAt: null,
          lastRunAt: null,
          lastRunStatus: null,
          lastRunError: null,
          nextRunAt: null,
          intervalMs: 3600000,
          totalRuns: 0,
          totalErrors: 0,
          tenantId: 'default',
          pid: null,
        },
        lastDigest: null,
        recentEvents: [],
        llm: { ok: true },
        messages: [],
      } as any,
      benchmarks: [
        {
          serverName: 'fs',
          totalCalls: 2,
          blockedRate: 0.5,
          avgLatencyMs: 35,
          avgTokens: 20,
          peerBlockedRateP50: 0.4,
          peerBlockedRateP90: 0.7,
          peerLatencyP50: 30,
          peerLatencyP90: 60,
          status: 'neutral',
        },
      ],
    });
    expect(report.controls.trafficProtected).toBe(true);
    expect(report.metrics.totalCalls).toBe(2);
    expect(report.benchmarkSummary.servers).toBe(1);
  });
});
