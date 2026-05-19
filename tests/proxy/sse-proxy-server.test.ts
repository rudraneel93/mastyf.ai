import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { SseProxyServer } from '../../src/proxy/sse-proxy-server.js';
import type { PolicyEngine } from '../../src/policy/policy-engine.js';
import * as callRecordCost from '../../src/utils/call-record-cost.js';

function startMockUpstreamMcp(): Promise<{ url: string; close: () => void }> {
  const sessions = new Map<string, boolean>();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (req.method === 'GET') {
      const sid = 'upstream-sess-1';
      sessions.set(sid, true);
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(`event: endpoint\ndata: /message?sessionId=${sid}\n\n`);
      res.end();
      return;
    }
    if (req.method === 'POST' && url.pathname === '/message') {
      const sid = url.searchParams.get('sessionId');
      if (!sid || !sessions.has(sid)) {
        res.writeHead(400);
        res.end();
        return;
      }
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const msg = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (msg.method === 'tools/call') {
          res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'ok' }] } }));
        } else {
          res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05' } }));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => server.close(),
      });
    });
  });
}

describe('SseProxyServer', () => {
  let upstream: { url: string; close: () => void } | null = null;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    upstream?.close();
    upstream = null;
  });

  it('uses evaluateAsync for tools/call policy checks', async () => {
    const evaluateAsync = vi.fn().mockResolvedValue({
      action: 'block',
      rule: 'test-rule',
      reason: 'blocked for test',
    });
    const policy = { evaluateAsync } as unknown as PolicyEngine;
    const db = { addCallRecord: vi.fn() };

    const proxy = new SseProxyServer({
      upstreamUrl: 'http://127.0.0.1:9/never-called',
      serverName: 'sse-test',
      policy,
      db: db as any,
    });

    const result = await proxy.interceptAndForward({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'eval', arguments: { cmd: 'id' } },
    });

    expect(evaluateAsync).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ error: { code: -32001 } });
  });

  it('passes through when evaluateAsync allows', async () => {
    const evaluateAsync = vi.fn().mockResolvedValue({
      action: 'pass',
      rule: 'default',
      reason: 'ok',
    });
    const policy = {
      evaluateAsync,
      evaluateResponse: vi.fn().mockReturnValue({ clean: true, detections: [] }),
      getMode: vi.fn().mockReturnValue('audit'),
    } as unknown as PolicyEngine;

    const proxy = new SseProxyServer({
      upstreamUrl: 'http://127.0.0.1:9/never-called',
      serverName: 'sse-test',
      policy,
      db: {} as any,
    });

    const forwardSpy = vi
      .spyOn(proxy as any, '_forwardToUpstream')
      .mockResolvedValue({ jsonrpc: '2.0', id: 2, result: { ok: true } });

    const result = await proxy.interceptAndForward({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'read_file', arguments: { path: '/tmp/x' } },
    });

    expect(evaluateAsync).toHaveBeenCalledOnce();
    expect(forwardSpy).toHaveBeenCalled();
    expect(result).toMatchObject({ result: { ok: true } });
  });

  it('discovers upstream session and forwards tools/call on message URL', async () => {
    upstream = await startMockUpstreamMcp();
    const evaluateAsync = vi.fn().mockResolvedValue({ action: 'pass', rule: 'default', reason: 'ok' });
    const policy = {
      evaluateAsync,
      evaluateResponse: vi.fn().mockReturnValue({ clean: true, detections: [] }),
      getMode: vi.fn().mockReturnValue('audit'),
    } as unknown as PolicyEngine;
    vi.spyOn(callRecordCost, 'persistCallRecord').mockResolvedValue({} as any);
    const proxy = new SseProxyServer({
      upstreamUrl: upstream.url,
      serverName: 'sse-integration',
      policy,
      db: { addCallRecord: vi.fn() } as any,
    });

    const discovered = await (proxy as any).discoverUpstreamSession(new URL(upstream.url));
    expect(discovered?.sessionId).toBe('upstream-sess-1');

    const session = {
      id: 'local-sess',
      upstreamSessionId: discovered!.sessionId,
      upstreamMessageUrl: discovered!.messageUrl,
      createdAt: Date.now(),
    };

    const result = await proxy.interceptAndForward(
      {
        jsonrpc: '2.0',
        id: 'tc-1',
        method: 'tools/call',
        params: { name: 'echo', arguments: { text: 'hi' } },
      },
      {},
      session,
    );
    expect(result.result).toBeDefined();
    expect(evaluateAsync).toHaveBeenCalled();
  });

  it('GET /sse emits endpoint event with sessionId', async () => {
    upstream = await startMockUpstreamMcp();
    const proxy = new SseProxyServer({
      upstreamUrl: upstream.url,
      serverName: 'sse-get',
      db: { addCallRecord: vi.fn() } as any,
    });
    const port = await proxy.start(0);
    const sseText = await new Promise<string>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/sse`, (res) => {
        let buf = '';
        res.on('data', (c) => { buf += c.toString(); });
        res.on('end', () => resolve(buf));
        res.on('error', reject);
      }).on('error', reject);
    });
    expect(sseText).toContain('event: endpoint');
    expect(sseText).toMatch(/sessionId=[a-f0-9-]+/i);
    await proxy.stop();
  });
});
