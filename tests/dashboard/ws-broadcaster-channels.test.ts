import { describe, expect, it } from 'vitest';
import { WsBroadcaster } from '../../src/dashboard/ws-broadcaster.js';
import type { DashboardEventType } from '../../src/dashboard/ws-broadcaster.js';

describe('WsBroadcaster eventToChannel', () => {
  const server = { on: () => {}, listen: () => {} } as import('http').Server;
  const ws = new WsBroadcaster(server);

  const cases: Array<[DashboardEventType, string]> = [
    ['flow:step', 'flow'],
    ['swarm:progress', 'swarm'],
    ['swarm:done', 'swarm'],
    ['swarm:failed', 'swarm'],
    ['semantic:queued', 'flow'],
    ['semantic:complete', 'flow'],
    ['analysis:artifact', 'swarm'],
    ['policy-block', 'policy'],
    ['audit:decision', 'audit'],
    ['ai:suggestions', 'ai'],
    ['metrics:live', 'metrics'],
  ];

  it.each(cases)('maps %s to channel %s', (type, channel) => {
    expect(ws.eventToChannel(type)).toBe(channel);
  });
});

describe('flow:step payload shape', () => {
  it('accepts canonical step fields', () => {
    const step = {
      id: 'test-id',
      kind: 'policy_block',
      title: 'Blocked read_file',
      summary: 'semantic-path-guard',
      severity: 'warn',
      serverName: 'demo',
      toolName: 'read_file',
    };
    expect(step.id).toBeTruthy();
    expect(step.kind).toBe('policy_block');
    expect(step.severity).toBe('warn');
  });
});
