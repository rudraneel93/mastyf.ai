import { describe, it, expect, vi } from 'vitest';
import { SecurityScanner } from '../../src/services/security-scanner.js';
import { CveChecker } from '../../src/scanners/cve-checker.js';

vi.mock('../../src/scanners/cve-checker.js');

describe('SecurityScanner package-aware scans', () => {
  const mockCve = {
    checkServerPackages: vi.fn().mockResolvedValue({ findings: [], lookupStatus: 'ok' }),
  };
  const scanner = new SecurityScanner(mockCve as unknown as CveChecker);

  it('flags typo-squat package in npx args', async () => {
    const report = await scanner.scanServer({
      name: 'innocent-label',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotool/server-filesystem', '/tmp'],
    });
    expect(report.typoSquatRisk.length).toBeGreaterThan(0);
    expect(report.typoSquatRisk[0].similarityTo).toContain('server-filesystem');
  });

  it('does not flag node as dangerous when used as MCP launcher', async () => {
    const report = await scanner.scanServer({
      name: 'dev',
      transport: 'stdio',
      command: 'node',
      args: ['benchmarks/fixtures/echo-server.cjs'],
    });
    const nodeWarnings = report.recommendations.filter((r) => r.includes('node'));
    expect(nodeWarnings).toHaveLength(0);
  });
});
