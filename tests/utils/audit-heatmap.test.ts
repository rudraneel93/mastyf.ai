import { describe, expect, it } from 'vitest';
import { buildAuditHeatmap } from '../../src/utils/audit-heatmap.js';
import type { ProxyCallRecord } from '../../src/types.js';

describe('buildAuditHeatmap', () => {
  it('aggregates blocked calls by rule and tool', () => {
    const records: ProxyCallRecord[] = [
      {
        serverName: 'fs',
        toolName: 'read_file',
        blockRule: 'path-guard',
        blocked: true,
        requestTokens: 0,
        responseTokens: 0,
        totalTokens: 0,
        durationMs: 1,
        timestamp: new Date().toISOString(),
      },
      {
        serverName: 'fs',
        toolName: 'read_file',
        blockRule: 'path-guard',
        blocked: true,
        requestTokens: 0,
        responseTokens: 0,
        totalTokens: 0,
        durationMs: 1,
        timestamp: new Date().toISOString(),
      },
    ];
    const cells = buildAuditHeatmap(records);
    expect(cells).toHaveLength(1);
    expect(cells[0].count).toBe(2);
  });
});
