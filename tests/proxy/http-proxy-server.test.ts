import { describe, it, expect, afterEach } from 'vitest';
import { HttpProxyServer } from '../../src/proxy/http-proxy-server.js';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import type { PolicyConfig } from '../../src/policy/policy-types.js';

const minimalPolicy: PolicyConfig = {
  version: '1.0',
  policy: { mode: 'audit', rules: [] },
};

describe('HttpProxyServer', () => {
  let proxy: HttpProxyServer | null = null;

  afterEach(async () => {
    if (proxy) {
      await proxy.stop();
      proxy = null;
    }
  });

  it('starts and stops on ephemeral port', async () => {
    proxy = new HttpProxyServer(
      'http://127.0.0.1:9',
      'test-upstream',
      new PolicyEngine(minimalPolicy),
      undefined,
      undefined,
      0,
    );
    await proxy.start();
    const port = proxy.getPort();
    expect(port).toBeGreaterThan(0);
    await proxy.stop();
    proxy = null;
  });

  it('exposes server name and target', () => {
    proxy = new HttpProxyServer('https://api.example.com/mcp', 'remote', undefined, undefined, undefined, 0);
    expect(proxy.getServerName()).toBe('remote');
    expect(proxy.getTargetUrl()).toContain('api.example.com');
  });
});
