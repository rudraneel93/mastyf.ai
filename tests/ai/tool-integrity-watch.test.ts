import { describe, expect, it } from 'vitest';
import {
  buildServerBaseline,
  diffToolBaselines,
  summarizeToolIntegrityReports,
} from '../../src/ai/tool-integrity-watch.js';

describe('tool-integrity-watch', () => {
  it('detects added sensitive tools', () => {
    const prev = buildServerBaseline('fs', [{ name: 'read_file', description: 'read' }]);
    const cur = buildServerBaseline('fs', [
      { name: 'read_file', description: 'read' },
      { name: 'execute_command', description: 'run shell' },
    ]);
    const report = diffToolBaselines(prev, cur);
    expect(report.changed).toBe(true);
    expect(report.diffs.some((d) => d.kind === 'added' && d.toolName === 'execute_command')).toBe(true);
    expect(report.quarantineRecommended).toBe(true);
  });

  it('detects schema modification', () => {
    const prev = buildServerBaseline('fs', [
      { name: 'read_file', description: 'v1', inputSchema: { type: 'object' } },
    ]);
    const cur = buildServerBaseline('fs', [
      { name: 'read_file', description: 'v2', inputSchema: { type: 'object', properties: { path: {} } } },
    ]);
    const report = diffToolBaselines(prev, cur);
    expect(report.diffs.some((d) => d.kind === 'modified')).toBe(true);
  });

  it('summarizes reports', () => {
    const prev = buildServerBaseline('a', [{ name: 'read_file' }]);
    const cur = buildServerBaseline('a', [{ name: 'read_file' }, { name: 'run' }]);
    const summary = summarizeToolIntegrityReports([diffToolBaselines(prev, cur)]);
    expect(summary.serversChanged).toBe(1);
    expect(summary.criticalCount).toBeGreaterThan(0);
  });
});
