import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('multi-region failover preflight', () => {
  it('verify-multi-region-preflight script exists and checks RTT guidance', () => {
    const script = join(process.cwd(), 'scripts', 'verify-multi-region-preflight.sh');
    expect(existsSync(script)).toBe(true);
    const body = readFileSync(script, 'utf-8');
    expect(body).toMatch(/80/);
    expect(body).toMatch(/MULTI_REGION|multi.region/i);
  });

  it('federated mode resolves without remote peers', async () => {
    const { resolveFederatedMode } = await import('../../src/utils/federated-data-source.js');
    expect(resolveFederatedMode(null)).toBe('local');
  });
});
