import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createControlPlaneApp } from '../../src/control-plane/server.js';
import { COMPILED_RULES_SCHEMA_VERSION } from '../../src/control-plane/compiled-rules.js';

describe('control-plane /internal/api/rules', () => {
  const policyPath = `${process.cwd()}/default-policy.yaml`;
  let server: ReturnType<ReturnType<typeof createControlPlaneApp>['listen']> | null = null;
  let baseUrl = '';

  beforeEach(async () => {
    const app = createControlPlaneApp({ policyPath });
    server = app.listen(0);
    await once(server, 'listening');
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server!.close((err?: Error) => (err ? reject(err) : resolve()));
    });
    server = null;
  });

  it('returns compiled rules with schemaVersion and cache headers', async () => {
    const res = await fetch(`${baseUrl}/internal/api/rules`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    const etag = res.headers.get('etag');
    expect(etag).toBeTruthy();
    const body = await res.json() as Record<string, unknown>;
    expect(body.schemaVersion).toBe(COMPILED_RULES_SCHEMA_VERSION);
    expect(typeof body.generatedAt).toBe('string');
    expect(typeof body.sourcePolicyVersion).toBe('string');
    expect(Array.isArray(body.blockedTools)).toBe(true);
  });

  it('returns 304 when If-None-Match matches latest ETag', async () => {
    const first = await fetch(`${baseUrl}/internal/api/rules`);
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const second = await fetch(`${baseUrl}/internal/api/rules`, {
      headers: { 'if-none-match': etag! },
    });
    expect(second.status).toBe(304);
  });
});
