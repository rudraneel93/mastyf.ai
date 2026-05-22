import type { WsBroadcaster, DashboardEvent } from '../dashboard/ws-broadcaster.js';

export type { FlowStep, FlowStepKind, FlowStepSeverity } from './flow-events.js';
export { emitFlowStep } from './flow-events.js';

let broadcaster: WsBroadcaster | null = null;

export function setWsBroadcaster(instance: WsBroadcaster | null): void {
  broadcaster = instance;
}

export function getWsBroadcaster(): WsBroadcaster | null {
  return broadcaster;
}

export function broadcastDashboardEvent(event: DashboardEvent): void {
  broadcaster?.broadcast(event, event.tenantId);
}
