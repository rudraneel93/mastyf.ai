import { describe, it, expect, afterEach } from 'vitest';
import { isGatewayModeEnabled } from '../../src/tenant/gateway-mode.js';

describe('gateway-mode', () => {
  const prev = process.env.GUARDIAN_GATEWAY_MODE;

  afterEach(() => {
    if (prev === undefined) delete process.env.GUARDIAN_GATEWAY_MODE;
    else process.env.GUARDIAN_GATEWAY_MODE = prev;
  });

  it('detects env flag', () => {
    process.env.GUARDIAN_GATEWAY_MODE = 'true';
    expect(isGatewayModeEnabled()).toBe(true);
  });
});
