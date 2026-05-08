import { describe, it, expect, beforeEach } from 'vitest';
import { CostAuditor } from '../../src/services/cost-auditor.js';
import { HistoryDatabase } from '../../src/database/history-db.js';
import { PricingClient } from '../../src/clients/pricing-client.js';
import { ProxyCallRecord } from '../../src/types.js';

describe('CostAuditor', () => {
  let db: HistoryDatabase;
  let auditor: CostAuditor;
  let pricing: PricingClient;

  beforeEach(() => {
    db = new HistoryDatabase(':memory:');
    pricing = new PricingClient();
    auditor = new CostAuditor(pricing, db);
  });

  it('returns zero cost when no records', async () => {
    const report = await auditor.auditServer({ name: 'test', transport: 'stdio' });
    expect(report.tokensUsed).toBe(0);
    expect(report.toolBreakdown).toHaveLength(0);
    expect(report.note).toContain('No recorded call data');
  });

  it('correctly aggregates real request/response tokens', async () => {
    await db.addCallRecord({
      serverName: 'test',
      toolName: 'echo',
      requestTokens: 100,
      responseTokens: 200,
      totalTokens: 300,
      durationMs: 50,
      timestamp: new Date().toISOString(),
    });
    await db.addCallRecord({
      serverName: 'test',
      toolName: 'echo',
      requestTokens: 150,
      responseTokens: 250,
      totalTokens: 400,
      durationMs: 60,
      timestamp: new Date().toISOString(),
    });
    await db.addCallRecord({
      serverName: 'test',
      toolName: 'add',
      requestTokens: 80,
      responseTokens: 20,
      totalTokens: 100,
      durationMs: 30,
      timestamp: new Date().toISOString(),
    });

    // Flush DB so reads work
    db.flush();

    const report = await auditor.auditServer({ name: 'test', transport: 'stdio' });

    // Total tokens: 300 + 400 + 100 = 800
    expect(report.tokensUsed).toBe(300 + 400 + 100);

    // Input: 100 + 150 + 80 = 330
    expect(report.inputTokens).toBe(100 + 150 + 80);

    // Output: 200 + 250 + 20 = 470
    expect(report.outputTokens).toBe(200 + 250 + 20);

    expect(report.toolBreakdown).toHaveLength(2);

    const echoTool = report.toolBreakdown.find((t) => t.toolName === 'echo');
    expect(echoTool?.tokens).toBe(700);
    expect(echoTool?.calls).toBe(2);
    expect(echoTool?.cost).toBeGreaterThan(0);

    const addTool = report.toolBreakdown.find((t) => t.toolName === 'add');
    expect(addTool?.tokens).toBe(100);
    expect(addTool?.calls).toBe(1);
    expect(addTool?.cost).toBeGreaterThan(0);

    // Verify correct pricing: echo input=250, output=450
    // echo cost = (250/1M)*5 + (450/1M)*15 = 0.00125 + 0.00675 = 0.008
    expect(echoTool!.cost).toBeCloseTo(0.008, 5);

    // add input=80, output=20
    // add cost = (80/1M)*5 + (20/1M)*15 = 0.0004 + 0.0003 = 0.0007
    expect(addTool!.cost).toBeCloseTo(0.0007, 5);
  });

  it('handles single call correctly', async () => {
    await db.addCallRecord({
      serverName: 'single',
      toolName: 'search',
      requestTokens: 500,
      responseTokens: 1000,
      totalTokens: 1500,
      durationMs: 100,
      timestamp: new Date().toISOString(),
    });
    db.flush();

    const report = await auditor.auditServer({ name: 'single', transport: 'stdio' });
    expect(report.tokensUsed).toBe(1500);
    expect(report.inputTokens).toBe(500);
    expect(report.outputTokens).toBe(1000);
    expect(report.toolBreakdown).toHaveLength(1);
    expect(report.toolBreakdown[0].tokens).toBe(1500);
  });
});