/**
 * Canonical agent-flow timeline steps for dashboard WebSocket push.
 */
import { randomUUID } from 'node:crypto';
import { broadcastDashboardEvent } from './dashboard-events.js';

export type FlowStepKind =
  | 'tool_call'
  | 'policy_block'
  | 'policy_pass'
  | 'semantic_queued'
  | 'semantic_complete'
  | 'ai_suggestion'
  | 'swarm_phase'
  | 'swarm_done'
  | 'swarm_failed'
  | 'analysis_ready';

export type FlowStepSeverity = 'info' | 'warn' | 'error' | 'success';

export interface FlowStep {
  id: string;
  kind: FlowStepKind;
  title: string;
  summary: string;
  severity: FlowStepSeverity;
  serverName?: string;
  toolName?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export function emitFlowStep(step: Omit<FlowStep, 'id'> & { id?: string }): void {
  const id = step.id || randomUUID();
  const payload: FlowStep = {
    id,
    kind: step.kind,
    title: step.title,
    summary: step.summary,
    severity: step.severity,
    serverName: step.serverName,
    toolName: step.toolName,
    requestId: step.requestId,
    metadata: step.metadata,
  };
  broadcastDashboardEvent({
    type: 'flow:step',
    serverName: step.serverName,
    payload: { step: payload },
    timestamp: Date.now(),
  });
}
