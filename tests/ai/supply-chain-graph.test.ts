import { describe, expect, it } from 'vitest';
import { buildSupplyChainGraph } from '../../src/ai/supply-chain-graph.js';
import type { ServerToolBaseline } from '../../src/ai/tool-integrity-watch.js';

describe('supply-chain-graph', () => {
  it('builds server → tool → arg graph', () => {
    const baselines: ServerToolBaseline[] = [
      {
        serverName: 'filesystem',
        fingerprint: 'fp1',
        toolNames: ['read_file', 'write_file'],
        tools: [
          { name: 'read_file', descriptionHash: 'a', schemaHash: 'b' },
          { name: 'write_file', descriptionHash: 'c', schemaHash: 'd' },
        ],
        capturedAt: new Date().toISOString(),
      },
    ];
    const graph = buildSupplyChainGraph(baselines, { 'filesystem:read_file': 5 });
    expect(graph.nodes.some((n) => n.kind === 'server')).toBe(true);
    expect(graph.nodes.some((n) => n.kind === 'tool')).toBe(true);
    expect(graph.blastRadius.length).toBeGreaterThan(0);
  });
});
