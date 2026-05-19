import { describe, it, expect, vi } from 'vitest';
import { McpProxyServer } from '../../src/proxy/proxy-server.js';
import { HistoryDatabase } from '../../src/database/history-db.js';

describe('McpProxyServer stdin serial queue', () => {
  it('serializes rapid handleClientInput so currentRequestId is not raced', async () => {
    const db = new HistoryDatabase(':memory:');
    const proxy = new McpProxyServer(
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

    await Promise.all([
      proxy.handleClientInput(mkCall('a')),
      proxy.handleClientInput(mkCall('b')),
      proxy.handleClientInput(mkCall('c')),
    ]);

    const ends = order.filter((x) => x === 'end');
    expect(ends.length).toBe(3);
    expect(order).toEqual(['start', 'a', 'end', 'a', 'start', 'b', 'end', 'b', 'start', 'c', 'end', 'c']);

    proxy.kill();
    vi.restoreAllMocks();
  });
});
