import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpProxyServer } from '../../src/proxy/proxy-server.js';
import { HistoryDatabase } from '../../src/database/history-db.js';

describe('McpProxyServer stdin RequestIdLock', () => {
  let proxy: McpProxyServer | null = null;
  let db: HistoryDatabase | null = null;

  afterEach(() => {
    proxy?.kill();
    proxy = null;
    db?.close();
    db = null;
    vi.restoreAllMocks();
  });
  // McpProxyServer uses RequestIdLock (not global AsyncSerialQueue): same MCP id
  // serializes; distinct ids may overlap by design — see adversarial-harness analysis.

  it('serializes same request id so currentRequestId is not raced', async () => {
    db = new HistoryDatabase(':memory:');
    proxy = new McpProxyServer(
      'node',
      ['-e', 'process.stdin.resume()'],
      { PATH: process.env.PATH || '' },
      db,
      'serial-test',
    );

    const order: Array<string | number | null> = [];
    vi.spyOn(proxy as any, 'processClientInput').mockImplementation(async (raw: string) => {
      const msg = JSON.parse(raw);
      if (msg.method === 'tools/call' && msg.id) {
        order.push('start', msg.id);
        (proxy as any).currentRequestId = msg.id;
        await new Promise((r) => setTimeout(r, 30));
        order.push('end', (proxy as any).currentRequestId);
      }
    });

    const mkCall = (id: string) =>
      JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: 'echo', arguments: { n: id } },
      });

    const sameId = 'dup';
    await Promise.all([
      proxy.handleClientInput(mkCall(sameId)),
      proxy.handleClientInput(mkCall(sameId)),
      proxy.handleClientInput(mkCall(sameId)),
    ]);

    expect(order).toEqual([
      'start', sameId, 'end', sameId,
      'start', sameId, 'end', sameId,
      'start', sameId, 'end', sameId,
    ]);
  });

  it('allows concurrent handleClientInput for distinct request ids', async () => {
    db = new HistoryDatabase(':memory:');
    proxy = new McpProxyServer(
      'node',
      ['-e', 'process.stdin.resume()'],
      { PATH: process.env.PATH || '' },
      db,
      'parallel-test',
    );

    const order: string[] = [];
    vi.spyOn(proxy as any, 'processClientInput').mockImplementation(async (raw: string) => {
      const msg = JSON.parse(raw);
      if (msg.method === 'tools/call' && msg.id) {
        order.push(`start:${msg.id}`);
        await new Promise((r) => setTimeout(r, 40));
        order.push(`end:${msg.id}`);
      }
    });

    const mkCall = (id: string) =>
      JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: 'echo', arguments: { n: id } },
      });

    await Promise.all([
      proxy.handleClientInput(mkCall('a')),
      proxy.handleClientInput(mkCall('b')),
      proxy.handleClientInput(mkCall('c')),
    ]);

    expect(order.filter((x) => x.startsWith('start:'))).toHaveLength(3);
    expect(order.filter((x) => x.startsWith('end:'))).toHaveLength(3);
    // Overlap: distinct ids run in parallel (all starts before any end).
    expect(order.indexOf('end:a')).toBeGreaterThan(order.indexOf('start:b'));
  });
});
