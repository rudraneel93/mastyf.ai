import { describe, it, expect, vi } from 'vitest';
import { SecurityScanner } from '../../src/services/security-scanner.js';
import { CveChecker } from '../../src/scanners/cve-checker.js';
import { AuthProber } from '../../src/scanners/auth-prober.js';
import { TypoSquatDetector } from '../../src/scanners/typo-squat-detector.js';
import { SecretScanner } from '../../src/scanners/secret-scanner.js';

vi.mock('../../src/scanners/cve-checker.js');
vi.mock('../../src/scanners/auth-prober.js');
vi.mock('../../src/scanners/typo-squat-detector.js');
vi.mock('../../src/scanners/secret-scanner.js');

describe('SecurityScanner', () => {
  const mockCve = { check: vi.fn().mockResolvedValue([]) };
  const mockAuth = { probe: vi.fn().mockReturnValue({ hasAuthentication: true, isTransportEncrypted: true }) };
  const mockTypo = { detect: vi.fn().mockReturnValue([]) };
  const mockSecret = { scan: vi.fn().mockReturnValue([]) };

  const scanner = new SecurityScanner(
    mockCve as any,
    mockAuth as any,
    mockTypo as any,
    mockSecret as any
  );

  it('returns score 100 for perfect config', async () => {
    const report = await scanner.scanServer({ name: 'test', transport: 'stdio' });
    expect(report.score).toBe(100);
    expect(report.recommendations).toContain('No security issues found');
  });

  it('deducts for missing auth', async () => {
    mockAuth.probe.mockReturnValueOnce({ hasAuthentication: false, isTransportEncrypted: true });
    const report = await scanner.scanServer({ name: 'test', transport: 'stdio' });
    expect(report.score).toBeLessThan(100);
    expect(report.score).toBe(80); // 100 - 20 for no auth
  });

  it('deducts for critical CVEs', async () => {
    mockCve.check.mockResolvedValueOnce([{ id: 'CVE-1', severity: 'CRITICAL', summary: 'test' }]);
    mockAuth.probe.mockReturnValueOnce({ hasAuthentication: true, isTransportEncrypted: true });
    const report = await scanner.scanServer({ name: 'test', transport: 'stdio' });
    expect(report.score).toBe(60); // 100 - 40 for critical CVE
  });

  it('deducts for all issues combined', async () => {
    mockCve.check.mockResolvedValueOnce([
      { id: 'CVE-1', severity: 'CRITICAL', summary: 'critical' },
      { id: 'CVE-2', severity: 'HIGH', summary: 'high' },
    ]);
    mockAuth.probe.mockReturnValueOnce({ hasAuthentication: false, isTransportEncrypted: false });
    mockTypo.detect.mockReturnValueOnce([{ suspiciousName: 'bad', similarityTo: 'good', distance: 1 }]);
    mockSecret.scan.mockReturnValueOnce([{ type: 'api_key', location: 'env:', severity: 'MEDIUM' }]);

    const report = await scanner.scanServer({ name: 'test', transport: 'sse' });
    // 100 - 40(crit) - 20(high) - 20(auth) - 10(transport) - 30(typo) - 15(secrets) = -35 → 0
    expect(report.score).toBe(0);
  });
});