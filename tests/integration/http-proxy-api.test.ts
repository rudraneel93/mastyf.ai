import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { HttpProxyServer } from '../../src/proxy/http-proxy-server.js';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import { HistoryDatabase } from '../../src/database/history-db.js';
import type { PolicyConfig } from '../../src/policy/policy-types.js';

type EchoState = {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
};

let echoState: EchoState = { method: '', url: '', headers: {}, body: '' };
let upstream: http.Server;
let upstreamPort = 0;

const blockPolicy: PolicyConfig = {
  version: '1.0',
  policy: {
    mode: 'block',
    rules: [
      { name: 'deny-dangerous', action: 'block', tools: { deny: ['execute_command', 'eval'] } },
      { name: 'injection', action: 'block', patterns: ['DROP\\s+TABLE'] },
      { name: 'rate-limit', action: 'block', maxCallsPerMinute: 3 },
    ],
    default_action: 'pass',
  },
};

function toolsCall(id: number, tool: string, args: Record<string, unknown> = {}) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name: tool, arguments: args },
  });
}

async function startProxy(
  policy?: PolicyEngine,
  port = 0,
): Promise<HttpProxyServer> {
  const proxy = new HttpProxyServer(
    `http://127.0.0.1:${upstreamPort}`,
    'http-test',
    policy,
    undefined,
    new HistoryDatabase(':memory:'),
    port,
  );
  await proxy.start();
  return proxy;
}

async function request(
  proxyPort: number,
  init: RequestInit & { path?: string } = {},
): Promise<{ status: number; text: string; headers: Headers }> {
  const path = init.path ?? '/mcp';
  const res = await fetch(`http://127.0.0.1:${proxyPort}${path}`, {
    ...init,
    headers: init.headers as HeadersInit,
  });
  return { status: res.status, text: await res.text(), headers: res.headers };
}

describe('integration: HttpProxyServer HTTP API', () => {
  const prevDpop = process.env.GUARDIAN_LEGACY_NO_DPOP;

  beforeAll(async () => {
    process.env.GUARDIAN_LEGACY_NO_DPOP = 'true';
    upstream = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        echoState = {
          method: req.method || '',
          url: req.url || '',
          headers: { ...req.headers },
          body: Buffer.concat(chunks).toString(),
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            echoed: true,
            method: echoState.method,
            url: echoState.url,
            body: echoState.body,
          }),
        );
      });
    });
    await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', () => r()));
    upstreamPort = (upstream.address() as { port: number }).port;
  });

  afterAll(async () => {
    await new Promise<void>((r) => upstream.close(() => r()));
    if (prevDpop === undefined) delete process.env.GUARDIAN_LEGACY_NO_DPOP;
    else process.env.GUARDIAN_LEGACY_NO_DPOP = prevDpop;
  });

  describe('method forwarding', () => {
    let proxy: HttpProxyServer;
    let proxyPort = 0;

    beforeEach(async () => {
      proxy = await startProxy(new PolicyEngine(blockPolicy));
      proxyPort = proxy.getPort();
    });

    afterEach(async () => {
      await proxy.stop();
    });

    it('forwards GET unchanged', async () => {
      const res = await request(proxyPort, { method: 'GET' });
      expect(res.status).toBe(200);
      expect(echoState.method).toBe('GET');
    });

    it('forwards POST with JSON body', async () => {
      const body = toolsCall(1, 'read_file', { path: '/tmp/a' });
      const res = await request(proxyPort, { method: 'POST', body });
      expect(res.status).toBe(200);
      expect(echoState.method).toBe('POST');
      expect(echoState.body).toBe(body);
    });

    it('forwards PUT with plain body', async () => {
      const res = await request(proxyPort, {
        method: 'PUT',
        body: 'plain-payload',
        headers: { 'Content-Type': 'text/plain' },
      });
      expect(res.status).toBe(200);
      expect(echoState.method).toBe('PUT');
      expect(echoState.body).toBe('plain-payload');
    });
  });

  describe('URL and headers', () => {
    let proxy: HttpProxyServer;
    let proxyPort = 0;

    beforeEach(async () => {
      proxy = await startProxy(new PolicyEngine(blockPolicy));
      proxyPort = proxy.getPort();
    });

    afterEach(async () => {
      await proxy.stop();
    });

    it('preserves query string on upstream URL', async () => {
      await request(proxyPort, {
        method: 'GET',
        path: '/mcp?foo=bar&inject=%3Cscript%3E',
      });
      expect(echoState.url).toContain('foo=bar');
      expect(echoState.url).toContain('inject');
    });

    it('forwards custom Authorization header', async () => {
      await request(proxyPort, {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token-abc' },
      });
      expect(echoState.headers.authorization).toBe('Bearer test-token-abc');
    });

    it('forwards X-Request-Id header', async () => {
      await request(proxyPort, {
        method: 'GET',
        headers: { 'X-Request-Id': 'req-uuid-99' },
      });
      expect(echoState.headers['x-request-id']).toBe('req-uuid-99');
    });

    it('forwards Content-Type for POST', async () => {
      await request(proxyPort, {
        method: 'POST',
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(echoState.headers['content-type']).toMatch(/application\/json/i);
    });

    it('forwards Accept header', async () => {
      await request(proxyPort, {
        method: 'GET',
        headers: { Accept: 'application/json, text/event-stream' },
      });
      expect(echoState.headers.accept).toContain('application/json');
    });

    it('forwards User-Agent', async () => {
      await request(proxyPort, {
        method: 'GET',
        headers: { 'User-Agent': 'guardian-test/1.0' },
      });
      expect(echoState.headers['user-agent']).toBe('guardian-test/1.0');
    });
  });

  describe('tenant header', () => {
    let proxy: HttpProxyServer;
    let proxyPort = 0;
    const prevTenant = process.env.GUARDIAN_TENANT_ID;

    beforeEach(async () => {
      process.env.GUARDIAN_TENANT_ID = 'default';
      proxy = await startProxy(new PolicyEngine(blockPolicy));
      proxyPort = proxy.getPort();
    });

    afterEach(async () => {
      await proxy.stop();
    });

    afterAll(() => {
      if (prevTenant === undefined) delete process.env.GUARDIAN_TENANT_ID;
      else process.env.GUARDIAN_TENANT_ID = prevTenant;
    });

    it('accepts X-Guardian-Tenant header', async () => {
      const res = await request(proxyPort, {
        method: 'POST',
        body: toolsCall(2, 'read_file'),
        headers: { 'X-Guardian-Tenant': 'acme-corp' },
      });
      expect(res.status).toBe(200);
    });

    it('rejects invalid tenant id', async () => {
      const res = await request(proxyPort, {
        method: 'GET',
        headers: { 'X-Guardian-Tenant': 'bad tenant!' },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('policy enforcement on tools/call', () => {
    let proxy: HttpProxyServer;
    let proxyPort = 0;

    beforeEach(async () => {
      proxy = await startProxy(new PolicyEngine(blockPolicy));
      proxyPort = proxy.getPort();
    });

    afterEach(async () => {
      await proxy.stop();
    });

    it('blocks denied tool with 403', async () => {
      const res = await request(proxyPort, {
        method: 'POST',
        body: toolsCall(10, 'execute_command', { cmd: 'ls' }),
      });
      expect(res.status).toBe(403);
      expect(res.text).toMatch(/Blocked by MCP Guardian/);
    });

    it('blocks eval tool', async () => {
      const res = await request(proxyPort, {
        method: 'POST',
        body: toolsCall(11, 'eval', { code: '1+1' }),
      });
      expect(res.status).toBe(403);
    });

    it('blocks SQL injection pattern in arguments', async () => {
      const res = await request(proxyPort, {
        method: 'POST',
        body: toolsCall(12, 'query_db', { sql: 'DROP TABLE users' }),
      });
      expect(res.status).toBe(403);
    });

    it('allows safe tool call through to upstream', async () => {
      const res = await request(proxyPort, {
        method: 'POST',
        body: toolsCall(13, 'read_file', { path: '/tmp/safe-readme.txt' }),
      });
      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.text);
      expect(parsed.echoed).toBe(true);
    });

    it('returns JSON-RPC error shape on block', async () => {
      const res = await request(proxyPort, {
        method: 'POST',
        body: toolsCall(14, 'execute_command'),
      });
      const err = JSON.parse(res.text);
      expect(err.error?.code).toBe(-32001);
    });
  });

  describe('rate limiting', () => {
    let proxy: HttpProxyServer;
    let proxyPort = 0;

    beforeEach(async () => {
      proxy = await startProxy(new PolicyEngine(blockPolicy));
      proxyPort = proxy.getPort();
    });

    afterEach(async () => {
      await proxy.stop();
    });

    it('returns 429 after maxCallsPerMinute exceeded', async () => {
      for (let i = 0; i < 3; i++) {
        const ok = await request(proxyPort, {
          method: 'POST',
          body: toolsCall(100 + i, 'read_file', { n: i }),
        });
        expect(ok.status).toBe(200);
      }
      const limited = await request(proxyPort, {
        method: 'POST',
        body: toolsCall(200, 'read_file', { n: 99 }),
      });
      expect(limited.status).toBe(429);
      expect(limited.text).toMatch(/Rate limit/i);
    });
  });

  describe('no policy / passthrough', () => {
    let proxy: HttpProxyServer;
    let proxyPort = 0;

    beforeEach(async () => {
      proxy = await startProxy(undefined);
      proxyPort = proxy.getPort();
    });

    afterEach(async () => {
      await proxy.stop();
    });

    it('forwards dangerous tool when policy engine absent', async () => {
      const res = await request(proxyPort, {
        method: 'POST',
        body: toolsCall(20, 'execute_command'),
      });
      expect(res.status).toBe(200);
    });

    it('forwards non-JSON POST body', async () => {
      const res = await request(proxyPort, {
        method: 'POST',
        body: 'not-json',
        headers: { 'Content-Type': 'text/plain' },
      });
      expect(res.status).toBe(200);
      expect(echoState.body).toBe('not-json');
    });
  });

  describe('proxy metadata', () => {
    it('exposes server name and target URL', async () => {
      const proxy = await startProxy();
      expect(proxy.getServerName()).toBe('http-test');
      expect(proxy.getTargetUrl()).toContain(`127.0.0.1:${upstreamPort}`);
      await proxy.stop();
    });

    it('binds ephemeral port', async () => {
      const proxy = await startProxy();
      expect(proxy.getPort()).toBeGreaterThan(0);
      await proxy.stop();
    });
  });

  describe('path variants', () => {
    let proxy: HttpProxyServer;
    let proxyPort = 0;

    beforeEach(async () => {
      proxy = await startProxy(new PolicyEngine(blockPolicy));
      proxyPort = proxy.getPort();
    });

    afterEach(async () => {
      await proxy.stop();
    });

    it('forwards /sse path', async () => {
      await request(proxyPort, { method: 'GET', path: '/sse' });
      expect(echoState.url).toBe('/sse');
    });

    it('forwards /message path', async () => {
      await request(proxyPort, { method: 'POST', path: '/message', body: '{}' });
      expect(echoState.url).toBe('/message');
    });

    it('forwards nested resource path', async () => {
      await request(proxyPort, { method: 'GET', path: '/v1/mcp/tools/list' });
      expect(echoState.url).toBe('/v1/mcp/tools/list');
    });
  });

  describe('header manipulation resistance', () => {
    let proxy: HttpProxyServer;
    let proxyPort = 0;

    beforeEach(async () => {
      proxy = await startProxy(new PolicyEngine(blockPolicy));
      proxyPort = proxy.getPort();
    });

    afterEach(async () => {
      await proxy.stop();
    });

    it('forwards duplicate-safe custom headers', async () => {
      await request(proxyPort, {
        method: 'GET',
        headers: { 'X-Custom-Guard': 'on', 'X-Forwarded-For': '10.0.0.1' },
      });
      expect(echoState.headers['x-custom-guard']).toBe('on');
    });

    it('does not strip Host override on upstream', async () => {
      await request(proxyPort, { method: 'GET' });
      expect(echoState.headers.host).toBeDefined();
    });
  });

  describe('large and empty bodies', () => {
    let proxy: HttpProxyServer;
    let proxyPort = 0;

    beforeEach(async () => {
      proxy = await startProxy(new PolicyEngine(blockPolicy));
      proxyPort = proxy.getPort();
    });

    afterEach(async () => {
      await proxy.stop();
    });

    it('forwards empty POST body', async () => {
      const res = await request(proxyPort, { method: 'POST', body: '' });
      expect(res.status).toBe(200);
      expect(echoState.body).toBe('');
    });

    it('forwards 4KB JSON body', async () => {
      const big = 'x'.repeat(4096);
      const res = await request(proxyPort, {
        method: 'POST',
        body: toolsCall(30, 'read_file', { data: big }),
      });
      expect(res.status).toBe(200);
      expect(echoState.body.length).toBeGreaterThan(4000);
    });
  });

  describe('concurrent requests', () => {
    it('handles parallel GETs', async () => {
      const proxy = await startProxy(new PolicyEngine(blockPolicy));
      const port = proxy.getPort();
      const results = await Promise.all(
        Array.from({ length: 5 }, () => request(port, { method: 'GET' })),
      );
      expect(results.every((r) => r.status === 200)).toBe(true);
      await proxy.stop();
    });
  });

  describe('initialize (non tools/call)', () => {
    let proxy: HttpProxyServer;
    let proxyPort = 0;

    beforeEach(async () => {
      proxy = await startProxy(new PolicyEngine(blockPolicy));
      proxyPort = proxy.getPort();
    });

    afterEach(async () => {
      await proxy.stop();
    });

    it('forwards initialize without policy block', async () => {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '1' } },
      });
      const res = await request(proxyPort, { method: 'POST', body });
      expect(res.status).toBe(200);
    });
  });
});
