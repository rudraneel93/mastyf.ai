import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface GuardianCertificationStatus {
  certified: boolean;
  level: 'none' | 'bronze' | 'silver' | 'gold';
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  issuedAt: string;
}

function readJsonSafe(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function evaluateGuardianCertification(repoRoot: string): GuardianCertificationStatus {
  const parity = readJsonSafe(join(repoRoot, 'adversarial-harness', 'reports', 'parity-report.json'));
  const swarm = readJsonSafe(join(repoRoot, 'reports', 'security-swarm', 'report.json'));
  const checks = [
    {
      name: 'parity_full_match',
      passed: Number(parity?.['agreementRate'] || 0) >= 0.999,
      detail: `agreementRate=${String(parity?.['agreementRate'] ?? 'missing')}`,
    },
    {
      name: 'swarm_overall_pass',
      passed: Boolean(swarm?.['overall']) === true,
      detail: `overall=${String(swarm?.['overall'] ?? 'missing')}`,
    },
    {
      name: 'swarm_zero_net_new_bypass',
      passed: Number((swarm?.['bypasses'] as Record<string, unknown> | undefined)?.['netNew'] || -1) === 0,
      detail: `netNew=${String((swarm?.['bypasses'] as Record<string, unknown> | undefined)?.['netNew'] ?? 'missing')}`,
    },
  ];
  const passed = checks.filter((c) => c.passed).length;
  const level: GuardianCertificationStatus['level'] =
    passed === 3 ? 'gold' : passed === 2 ? 'silver' : passed === 1 ? 'bronze' : 'none';
  return {
    certified: passed >= 2,
    level,
    checks,
    issuedAt: new Date().toISOString(),
  };
}

export function buildPartnerSignalFeed(repoRoot: string): {
  generatedAt: string;
  certification: GuardianCertificationStatus;
  signals: Array<{ key: string; value: string | number | boolean }>;
} {
  const cert = evaluateGuardianCertification(repoRoot);
  return {
    generatedAt: new Date().toISOString(),
    certification: cert,
    signals: [
      { key: 'guardian_certified', value: cert.certified },
      { key: 'guardian_certification_level', value: cert.level },
      { key: 'guardian_checks_passed', value: cert.checks.filter((c) => c.passed).length },
    ],
  };
}
