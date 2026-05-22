import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketProxyServer } from '../../src/proxy/websocket-proxy-server.js';
import { PolicyEngine } from '../../src/policy/policy-engine.js';

function stubWs(sent: string[]) {
  return {
    readyState: 1,
    send: (data: string) => {
      sent.push(data);
    },
    close: () => {},
    on: () => {},
  };
}

describe('WebSocketProxyServer', () => {
  const prevDlp = process.env['GUARDIAN_RESPONSE_DLP_MODE'];

  beforeEach(() => {
    process.env['GUARDIAN_RESPONSE_DLP_MODE'] = 'block';
  });

  afterEach(() => {
    if (prevDlp === undefined) delete process.env['GUARDIAN_RESPONSE_DLP_MODE'];
    else process.env['GUARDIAN_RESPONSE_DLP_MODE'] = prevDlp;
  });

  it('blocks tools/call when policy evaluateAsync denies', async () => {
    const policy = new PolicyEngine({
      version: '1.0',
      policy: {
        mode: 'block',
        default_action: 'allow',
        rules: [{ name: 'deny-eval', action: 'block', tools: { deny: ['eval'] } }],
      },
    });

    const proxy = new WebSocketProxyServer({
      listenPort: 0,
      upstreamWsUrl: 'ws://127.0.0.1:9',
      serverName: 'ws-test',
      policy,
    });

    const sent: string[] = [];
    const upstreamSent: string[] = [];
    const clientWs = stubWs(sent);
    const upstream = stubWs(upstreamSent);

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

    expect(sent.length).toBe(1);
    expect(JSON.parse(sent[0]!).error?.code).toBe(-32001);
    expect(upstreamSent.length).toBe(0);
  });

  it('blocks when rug-pull flag is set', async () => {
    const policy = new PolicyEngine({
      version: '1.0',
      policy: { mode: 'block', default_action: 'allow', rules: [] },
    });
    const proxy = new WebSocketProxyServer({
      listenPort: 0,
      upstreamWsUrl: 'ws://127.0.0.1:9',
      serverName: 'ws-rug',
      policy,
    });
    (proxy as any).rugPullBlocked = true;

    const sent: string[] = [];
    const clientWs = stubWs(sent);
    const upstream = stubWs([]);
    const req = { headers: {} } as import('http').IncomingMessage;

    await (proxy as any).interceptMessage(
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'x' } }),
      clientWs,
      upstream,
      req,
    );

    expect(JSON.parse(sent[0]!).error?.message).toContain('rug-pull');
    expect(sent.length).toBe(1);
  });

  describe('response security gate', () => {
    const prevMode = process.env.GUARDIAN_RESPONSE_DLP_MODE;

    afterEach(() => {
      if (prevMode) process.env.GUARDIAN_RESPONSE_DLP_MODE = prevMode;
      else delete process.env.GUARDIAN_RESPONSE_DLP_MODE;
    });

    beforeEach(() => {
      process.env.GUARDIAN_RESPONSE_DLP_MODE = 'block';
    });

    it('blocks tool result when DLP finds critical content in block mode', async () => {
      const policy = new PolicyEngine({
        version: '1.0',
        policy: { mode: 'block', default_action: 'block', rules: [] },
      });
      const proxy = new WebSocketProxyServer({
        listenPort: 0,
        upstreamWsUrl: 'ws://127.0.0.1:9',
        serverName: 'ws-dlp',
        policy,
      });

      const msg = {
        jsonrpc: '2.0',
        id: 9,
        result: { note: 'patient ssn 123-45-6789' },
      };
      const blocked = await (proxy as any).inspectToolResponse('read_file', msg, 9);
      expect(blocked).not.toBeNull();
      expect(blocked.error?.code).toBe(-32002);
      expect(String(blocked.error?.message)).toContain('blocked');
    });

    it('redacts tool result in redact mode and forwards modified payload', async () => {
      process.env.GUARDIAN_RESPONSE_DLP_MODE = 'redact';
      const policy = new PolicyEngine({
        version: '1.0',
        policy: { mode: 'block', default_action: 'block', rules: [] },
      });
      const proxy = new WebSocketProxyServer({
        listenPort: 0,
        upstreamWsUrl: 'ws://127.0.0.1:9',
        serverName: 'ws-redact',
        policy,
      });

      const msg = {
        jsonrpc: '2.0',
        id: 10,
        result: { note: 'patient ssn 123-45-6789' },
      };
      const blocked = await (proxy as any).inspectToolResponse('read_file', msg, 10);
      expect(blocked).toBeNull();
      expect(JSON.stringify(msg.result)).not.toContain('123-45-6789');
    });
  });

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
