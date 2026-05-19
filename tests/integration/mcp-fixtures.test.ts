import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { HistoryDatabase } from '../../src/database/history-db.js';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import { McpProxyServer } from '../../src/proxy/proxy-server.js';
import type { PolicyConfig } from '../../src/policy/policy-types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ECHO = resolve(__dirname, '..', '..', 'benchmarks', 'fixtures', 'echo-server.cjs');
const FS_FIXTURE = resolve(__dirname, '..', 'fixtures', 'filesystem-mcp-server.cjs');

const SQL_BLOCK_POLICY: PolicyConfig = {
  version: '1.0',
  policy: {
    mode: 'block',
    rules: [
      {
        name: 'sql-guard',
        action: 'block',
        patterns: ['DELETE\\s+FROM', 'DROP\\s+TABLE'],
      },
    ],
  },
};

function call(id: number, tool: string, args: Record<string, unknown> = {}): string {
  return (
    JSON.stringify({
      jsonrpc: '2.0',
      id: String(id),
      method: 'tools/call',
      params: { name: tool, arguments: args },
    }) + '\n'
  );
}

function init(id: number): string {
  return (
    JSON.stringify({
      jsonrpc: '2.0',
      id: String(id),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'fixture-test', version: '1.0' },
      },
    }) + '\n'
  );
}

describe('integration: MCP fixtures matrix', () => {
  describe('echo stdio', () => {
    let db: HistoryDatabase;
    let proxy: McpProxyServer;
    const responses = new Map<string, unknown>();
    let origWrite: typeof process.stdout.write;

    beforeAll(async () => {
      db = new HistoryDatabase(':memory:');
      proxy = new McpProxyServer(
        'node',
        [ECHO],
        {},
        db,
        'echo-fixture',
        new PolicyEngine(SQL_BLOCK_POLICY),
      );
      origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = function (chunk: unknown, ...args: unknown[]): boolean {
        try {
          const msg = JSON.parse(String(chunk));
          if (msg.id) responses.set(String(msg.id), msg);
        } catch {
          /* ignore */
        }
        return (origWrite as (...a: unknown[]) => boolean)(chunk, ...args);
      };
      await new Promise((r) => setTimeout(r, 400));
    });

    afterAll(() => {
      process.stdout.write = origWrite;
      proxy.kill();
      db.close();
    });

    it('passes safe echo call', async () => {
      proxy.handleClientInput(call(10, 'echo', { message: 'hi' }));
      await new Promise((r) => setTimeout(r, 500));
      const msg = responses.get('10') as { result?: unknown; error?: unknown };
      expect(msg?.error).toBeUndefined();
      expect(msg?.result).toBeDefined();
    });

    it('blocks SQL injection in args via proxy policy', async () => {
      proxy.handleClientInput(call(11, 'echo', { query: 'DELETE FROM users' }));
      await new Promise((r) => setTimeout(r, 500));
      const msg = responses.get('11') as { error?: { message?: string } };
      expect(msg?.error?.message).toMatch(/blocked|policy/i);
    });
  });

  describe('filesystem fixture', () => {
    let db: HistoryDatabase;
    let proxy: McpProxyServer;
    const responses = new Map<string, unknown>();
    let origWrite: typeof process.stdout.write;

    beforeAll(async () => {
      db = new HistoryDatabase(':memory:');
      proxy = new McpProxyServer(
        'node',
        [FS_FIXTURE],
        {},
        db,
        'fs-fixture',
        new PolicyEngine({ version: '1.0', policy: { mode: 'audit', rules: [] } }),
      );
      origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = function (chunk: unknown, ...args: unknown[]): boolean {
        try {
          const msg = JSON.parse(String(chunk));
          if (msg.id) responses.set(String(msg.id), msg);
        } catch {
          /* ignore */
        }
        return (origWrite as (...a: unknown[]) => boolean)(chunk, ...args);
      };
      proxy.handleClientInput(init(1));
      await new Promise((r) => setTimeout(r, 600));
    });

    afterAll(() => {
      process.stdout.write = origWrite;
      proxy.kill();
      db.close();
    });

    it('reads file through proxied filesystem MCP', async () => {
      proxy.handleClientInput(call(2, 'read_file', { path: 'hello.txt' }));
      await new Promise((r) => setTimeout(r, 800));
      const msg = responses.get('2') as { result?: { content?: { text?: string }[] } };
      const text = msg?.result?.content?.[0]?.text ?? '';
      expect(text).toContain('hello from filesystem fixture');
    });
  });
});
