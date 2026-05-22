import { describe, it, expect } from 'vitest';
import { WebSocketProxyServer } from '../../src/proxy/websocket-proxy-server.js';

describe('WebSocketProxyServer', () => {
  it('injects rotated session token into tool result _meta', () => {
    const proxy = new WebSocketProxyServer({
      listenPort: 0,
      upstreamWsUrl: 'ws://127.0.0.1:9',
      serverName: 'ws-sess',
    });
    (proxy as any).pendingSessionTokens.set(5, 'rotated-token-abc');
    const msg = { jsonrpc: '2.0', id: 5, result: { data: 'ok' } };
    (proxy as any).applyRotatedSessionToMessage(msg, 5);
    const meta = (msg.result as { _meta?: { sessionToken?: string } })._meta;
    expect(meta?.sessionToken).toBe('rotated-token-abc');
    expect((proxy as any).pendingSessionTokens.has(5)).toBe(false);
  });
});
