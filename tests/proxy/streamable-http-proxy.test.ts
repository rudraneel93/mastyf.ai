import { describe, it, expect, vi } from 'vitest';
import { StreamableHttpProxyServer } from '../../src/proxy/streamable-http-proxy-server.js';
import type { PolicyEngine } from '../../src/policy/policy-engine.js';

describe('StreamableHttpProxyServer', () => {
  it('blocks tools/call on POST /mcp when policy denies', async () => {
    const evaluateAsync = vi.fn().mockResolvedValue({
      action: 'block',
      rule: 'deny',
      reason: 'test',
    });
    const policy = { evaluateAsync, getMode: () => 'block' } as unknown as PolicyEngine;
    const proxy = new StreamableHttpProxyServer({
      listenPort: 0,
      upstreamBaseUrl: 'http://127.0.0.1:9',
      serverName: 'stream-test',
      policy,
    });

    const blocked = await (proxy as any).maybeBlockMessage(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'eval' },
      },
      { headers: {} },
    );

    expect(evaluateAsync).toHaveBeenCalled();
    expect(blocked?.error?.code).toBe(-32001);
  });
});
