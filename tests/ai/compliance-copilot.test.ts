import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ai/semantic-audit-store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ai/semantic-audit-store.js')>();
  return {
    ...actual,
    loadSemanticAuditRecordsAsync: vi.fn(async () => [
      {
        id: 'comp-1',
        tenantId: 'default',
        requestId: 'r1',
        serverName: 'filesystem',
        toolName: 'read_file',
        syncDecision: { action: 'block', rule: 'path-guard', reason: 'blocked' },
        semanticAudit: {
          suspicious: true,
          confidence: 0.9,
          categories: ['path-traversal'],
          reasoning: 'sensitive path',
        },
        timestamp: new Date().toISOString(),
      },
    ]),
  };
});

describe('compliance-copilot', () => {
  it('generates compliance report with control mappings', async () => {
    const { generateComplianceReport, formatComplianceMarkdown } = await import(
      '../../src/ai/compliance-copilot.js'
    );
    const report = await generateComplianceReport({ useLlm: false, windowDays: 7 });
    expect(report.controlMappings.length).toBeGreaterThan(0);
    expect(report.briefing).toBeTruthy();
    expect(report.exportFormats.markdown).toContain('Compliance Briefing');
    const md = formatComplianceMarkdown(report);
    expect(md).toContain('Compliance Briefing');
  });
});
