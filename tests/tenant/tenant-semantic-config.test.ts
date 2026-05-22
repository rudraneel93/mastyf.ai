import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isSyncSemanticResponseEnabledForTenant,
  isSemanticAsyncEnabledForTenant,
  isSemanticStrictForTenant,
  resetTenantSemanticConfigForTests,
} from '../../src/tenant/tenant-semantic-config.js';

describe('tenant semantic config', () => {
  const prev = process.env.GUARDIAN_TENANT_SEMANTIC_JSON;
  const prevSync = process.env.GUARDIAN_SEMANTIC_SYNC_RESPONSE;

  beforeEach(() => {
    resetTenantSemanticConfigForTests();
    delete process.env.GUARDIAN_SEMANTIC_SYNC_RESPONSE;
  });

  afterEach(() => {
    resetTenantSemanticConfigForTests();
    if (prev) process.env.GUARDIAN_TENANT_SEMANTIC_JSON = prev;
    if (prevSync) process.env.GUARDIAN_SEMANTIC_SYNC_RESPONSE = prevSync;
  });

  it('tenant override enables sync response for one tenant only', () => {
    process.env.GUARDIAN_TENANT_SEMANTIC_JSON = JSON.stringify({
      acme: { syncResponse: true },
      beta: { syncResponse: false },
    });
    expect(isSyncSemanticResponseEnabledForTenant('acme')).toBe(true);
    expect(isSyncSemanticResponseEnabledForTenant('beta')).toBe(false);
    expect(isSyncSemanticResponseEnabledForTenant('other')).toBe(false);
  });

  it('falls back to global async flag', () => {
    process.env.GUARDIAN_SEMANTIC_ASYNC = 'true';
    expect(isSemanticAsyncEnabledForTenant('any')).toBe(true);
  });

  it('tenant strict override', () => {
    process.env.GUARDIAN_TENANT_SEMANTIC_JSON = JSON.stringify({
      strict: { strict: true },
      lax: { strict: false },
    });
    delete process.env.GUARDIAN_SEMANTIC_STRICT;
    expect(isSemanticStrictForTenant('strict')).toBe(true);
    expect(isSemanticStrictForTenant('lax')).toBe(false);
  });
});
