export type AutopilotEventKind = 'threat' | 'decision' | 'rollout';

export interface AutopilotEventEnvelope<TPayload = Record<string, unknown>> {
  schemaVersion: '2026-05-1';
  kind: AutopilotEventKind;
  eventId: string;
  tenantId: string;
  timestamp: string;
  payload: TPayload;
}

export interface ThreatEventPayload {
  threatId: string;
  source: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  signature?: string;
  confidence: number;
}

export interface DecisionEventPayload {
  suggestionId: string;
  ruleName: string;
  action: 'approved' | 'rejected' | 'auto_applied' | 'rolled_back';
  actor: string;
  confidence: number;
}

export interface RolloutEventPayload {
  suggestionId: string;
  ruleName: string;
  stage: 'shadow' | 'canary' | 'enforce' | 'rollback';
  success: boolean;
  replayCoverage: number;
  canarySizePercent: number;
  predictedFpDelta: number;
  predictedBypassDelta: number;
}

function mkEventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeThreatEvent(
  tenantId: string,
  payload: ThreatEventPayload,
): AutopilotEventEnvelope<ThreatEventPayload> {
  return {
    schemaVersion: '2026-05-1',
    kind: 'threat',
    eventId: mkEventId('thr'),
    tenantId,
    timestamp: new Date().toISOString(),
    payload,
  };
}

export function makeDecisionEvent(
  tenantId: string,
  payload: DecisionEventPayload,
): AutopilotEventEnvelope<DecisionEventPayload> {
  return {
    schemaVersion: '2026-05-1',
    kind: 'decision',
    eventId: mkEventId('dec'),
    tenantId,
    timestamp: new Date().toISOString(),
    payload,
  };
}

export function makeRolloutEvent(
  tenantId: string,
  payload: RolloutEventPayload,
): AutopilotEventEnvelope<RolloutEventPayload> {
  return {
    schemaVersion: '2026-05-1',
    kind: 'rollout',
    eventId: mkEventId('rol'),
    tenantId,
    timestamp: new Date().toISOString(),
    payload,
  };
}
