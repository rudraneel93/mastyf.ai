/**
 * Agent Intent Graph — session-scoped kill-chain graph from flow history + chain patterns.
 */
import type { FlowEvent } from '../policy/session-flow-store.js';
import {
  buildSessionChainGraph,
  detectChainPatterns,
  type ChainGraphNode,
  type ChainGraphEdge,
  type ChainPatternMatch,
  type SessionChainGraph,
} from '../policy/session-chain-detector.js';

export type IntentGraphNodeRole = 'read' | 'transform' | 'exfil' | 'execute' | 'unknown';

export type IntentGraphNode = {
  index: number;
  toolName: string;
  role: IntentGraphNodeRole;
  at: number;
  sensitiveRead: boolean;
  encodeHint: boolean;
  exfilHint: boolean;
  citationId: string;
};

export type IntentGraphEdge = {
  from: number;
  to: number;
  kind: ChainGraphEdge['kind'];
};

export type AgentIntentGraph = {
  sessionKey: string;
  nodes: IntentGraphNode[];
  edges: IntentGraphEdge[];
  patterns: ChainPatternMatch[];
  inferredIntent: string;
  killChainStages: string[];
};

function classifyRole(node: ChainGraphNode): IntentGraphNodeRole {
  if (node.exfilHint) return 'exfil';
  if (node.encodeHint) return 'transform';
  if (node.sensitiveRead) return 'read';
  if (/run|exec|bash|eval|python|node/i.test(node.toolName)) return 'execute';
  return 'unknown';
}

function inferIntentFromPatterns(patterns: ChainPatternMatch[], nodes: IntentGraphNode[]): string {
  if (!patterns.length) {
    const roles = nodes.map((n) => n.role).filter((r) => r !== 'unknown');
    if (roles.length === 0) return 'single-tool activity';
    return `sequential ${roles.join(' → ')}`;
  }
  const best = patterns.sort((a, b) => b.confidence - a.confidence)[0];
  const toolPath = best.nodes.map((i) => nodes[i]?.toolName).filter(Boolean).join(' → ');
  return `${best.pattern.replace(/-/g, ' ')} (${Math.round(best.confidence * 100)}%): ${toolPath}`;
}

function killChainStagesFromPatterns(patterns: ChainPatternMatch[]): string[] {
  if (!patterns.length) return [];
  const best = patterns.sort((a, b) => b.confidence - a.confidence)[0];
  switch (best.pattern) {
    case 'read-encode-exfil':
      return ['reconnaissance', 'collection', 'transform', 'exfiltration'];
    case 'read-then-exfil':
      return ['collection', 'exfiltration'];
    case 'encode-then-exfil':
      return ['transform', 'exfiltration'];
    case 'multi-step-staging':
      return ['staging', 'collection', 'action'];
    default:
      return ['multi-step-chain'];
  }
}

export function buildAgentIntentGraph(sessionKey: string, flow: FlowEvent[]): AgentIntentGraph {
  const chainGraph: SessionChainGraph = buildSessionChainGraph(sessionKey, flow);
  const patterns = detectChainPatterns(chainGraph);

  const nodes: IntentGraphNode[] = chainGraph.nodes.map((n, index) => ({
    index,
    toolName: n.toolName,
    role: classifyRole(n),
    at: n.at,
    sensitiveRead: n.sensitiveRead,
    encodeHint: n.encodeHint,
    exfilHint: n.exfilHint,
    citationId: `flow:${index}`,
  }));

  const edges: IntentGraphEdge[] = chainGraph.edges.map((e) => ({
    from: e.from,
    to: e.to,
    kind: e.kind,
  }));

  const inferredIntent = inferIntentFromPatterns(patterns, nodes);
  const killChainStages = killChainStagesFromPatterns(patterns);

  return {
    sessionKey,
    nodes,
    edges,
    patterns,
    inferredIntent,
    killChainStages,
  };
}

export function buildKillChainNarrative(
  graph: AgentIntentGraph,
  anchorTool?: string,
  citations?: Array<{ id: string; summary: string }>,
): string {
  const parts: string[] = [];
  if (graph.killChainStages.length) {
    parts.push(`Kill-chain stages: ${graph.killChainStages.join(' → ')}.`);
  }
  parts.push(`Inferred intent: ${graph.inferredIntent}.`);
  if (anchorTool) {
    parts.push(`Trigger tool: ${anchorTool}.`);
  }
  if (graph.nodes.length >= 2) {
    const path = graph.nodes.map((n) => `${n.toolName}[${n.role}]`).join(' → ');
    parts.push(`Session path: ${path}.`);
  }
  const cite = citations?.[0]?.id;
  if (cite) parts.push(`[${cite}]`);
  return parts.join(' ');
}
