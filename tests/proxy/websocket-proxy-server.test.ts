import { describe, it, expect, vi } from 'vitest';
import { WebSocketProxyServer } from '../../src/proxy/websocket-proxy-server.js';
import type { PolicyEngine } from '../../src/policy/policy-engine.js';

describe('WebSocketProxyServer', () => {
  it('blocks tools/call when policy evaluateAsync denies', async () => {
    const evaluateAsync = vi.fn().mockResolvedValue({
      action: 'block',
      rule: 'deny',
      reason: 'test block',
    });
    const policy = { evaluateAsync } as unknown as PolicyEngine;

    const proxy = new WebSocketProxyServer({
      listenPort: 0,
      upstreamWsUrl: 'ws://127.0.0.1:9',
      serverName: 'ws-test',
      policy,
    });

    const sent: string[] = [];
    const clientWs = {
      readyState: 1,
      send: (data: string) => { sent.push(data); },
      close: vi.fn(),
      on: vi.fn(),
    };
    const upstream = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };

    const req = { headers: {} } as import('http').IncomingMessage;
    await (proxy as any).interceptMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'eval' },
      }),
      clientWs,
      upstream,
      req,
    );

    expect(evaluateAsync).toHaveBeenCalled();
    expect(sent.length).toBe(1);
    expect(JSON.parse(sent[0]!).error?.code).toBe(-32001);
    expect(upstream.send).not.toHaveBeenCalled();
  });

  it('blocks when rug-pull flag is set', async () => {
    const policy = { evaluateAsync: vi.fn() } as unknown as PolicyEngine;
    const proxy = new WebSocketProxyServer({
      listenPort: 0,
      upstreamWsUrl: 'ws://127.0.0.1:9',
      serverName: 'ws-rug',
      policy,
    });
    (proxy as any).rugPullBlocked = true;

    const sent: string[] = [];
    const clientWs = {
      readyState: 1,
      send: (data: string) => { sent.push(data); },
      close: vi.fn(),
      on: vi.fn(),
    };
    const upstream = { readyState: 1, send: vi.fn(), close: vi.fn(), on: vi.fn() };
    const req = { headers: {} } as import('http').IncomingMessage;

    await (proxy as any).interceptMessage(
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'x' } }),
      clientWs,
      upstream,
      req,
    );

    expect(JSON.parse(sent[0]!).error?.message).toContain('rug-pull');
    expect(upstream.send).not.toHaveBeenCalled();
  });
});
