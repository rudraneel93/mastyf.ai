import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { HistoryDatabase } from '../../src/database/history-db.js';
import { CostAuditor } from '../../src/services/cost-auditor.js';
import { PricingClient } from '../../src/clients/pricing-client.js';
import { McpServerConfig } from '../../src/types.js';

describe('Proxy-to-Audit Integration', () => {
  const DB = '/tmp/mcp-proxy-audit-test.db';
  const CFG = '/tmp/mcp-proxy-audit-cfg.json';
  const config: McpServerConfig = {
    name: 'mcp-guardian-integration',
    transport: 'stdio',
    command: 'node',
    args: [join(process.cwd(), 'dist', 'index.js')],
  };

  it('should capture real tokens via proxy and produce accurate cost report', async () => {
    // Clean start
    try { unlinkSync(DB); } catch {}
    try { unlinkSync(join(homedir(), '.mcp-guardian', 'history.db')); } catch {}

    writeFileSync(CFG, JSON.stringify({
      mcpServers: {
        'mcp-guardian-integration': {
          command: 'node',
          args: [join(process.cwd(), 'dist', 'index.js')],
          transport: 'stdio',
        },
      },
    }));

    // Start proxy
    const proxy = spawn('node', [join(process.cwd(), 'dist', 'cli.js'), 'proxy', '--config', CFG], {
      env: { ...process.env, MCP_GUARDIAN_DB_PATH: DB },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Wait for startup
    await new Promise(r => setTimeout(r, 3000));

    // Send initialize
    proxy.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 'i1', method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } } }) + '\n');
    await new Promise(r => setTimeout(r, 1500));

    // Send two tools/call requests
    proxy.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 'c1', method: 'tools/call', params: { name: 'audit_costs', arguments: { serverName: 'mcp-guardian-integration' } } }) + '\n');
    await new Promise(r => setTimeout(r, 3000));

    proxy.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 'c2', method: 'tools/call', params: { name: 'check_health', arguments: { serverName: 'mcp-guardian-integration' } } }) + '\n');
    await new Promise(r => setTimeout(r, 3000));

    // Kill proxy
    proxy.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 2000));

    // Now verify the cost auditor reads real data
    const db = new HistoryDatabase(DB);
    const pricing = new PricingClient();
    const auditor = new CostAuditor(pricing, db);
    const report = await auditor.auditServer(config);

    // Assertions: proxy must have stored real token data
    expect(report.tokensUsed).toBeGreaterThan(0);
    expect(report.toolBreakdown.length).toBeGreaterThanOrEqual(2);
    expect(report.estimatedCostUSD).toBeGreaterThan(0);
    expect(report.inputTokens).toBeGreaterThan(0);
    expect(report.outputTokens).toBeGreaterThan(0);
    expect(report.note).toBeUndefined(); // No "no data" note — real data exists

    // Cleanup
    db.close();
    try { unlinkSync(CFG); } catch {}
    try { unlinkSync(DB); } catch {}
  }, 30000);
});