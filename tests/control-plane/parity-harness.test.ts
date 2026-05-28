import { describe, expect, it } from 'vitest';
import {
  compareParity,
  validateFixtureCount,
  type ParityFixture,
} from '../../src/control-plane/parity-harness.js';

function fixture(n: number): ParityFixture[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `fx-${i + 1}`,
    method: 'tools/call',
    toolName: `tool-${i + 1}`,
    arguments: { index: i + 1 },
  }));
}

describe('control-plane parity harness helpers', () => {
  it('rejects fixture counts outside 20-50', () => {
    expect(() => validateFixtureCount(fixture(19))).toThrow(/20-50/);
    expect(() => validateFixtureCount(fixture(51))).toThrow(/20-50/);
    expect(() => validateFixtureCount(fixture(24))).not.toThrow();
  });

  it('reports mismatches when legacy/data-plane block states differ', async () => {
    const fixtures = fixture(20);
    const { summary, mismatches } = await compareParity(
      fixtures,
      async () => ({ status: 200, blocked: false, body: {} }),
      async (fx) => ({
        status: 200,
        blocked: fx.id === 'fx-1',
        body: {},
      }),
      'http://legacy',
      'http://dataplane',
    );
    expect(summary.compared).toBe(20);
    expect(summary.mismatches).toBe(1);
    expect(mismatches[0]?.id).toBe('fx-1');
  });

  it('returns success summary with zero mismatches when parity holds', async () => {
    const fixtures = fixture(24);
    const { summary, mismatches } = await compareParity(
      fixtures,
      async () => ({ status: 200, blocked: false, body: {} }),
      async () => ({ status: 200, blocked: false, body: {} }),
      'http://legacy',
      'http://dataplane',
    );
    expect(summary.fixtures).toBe(24);
    expect(summary.compared).toBe(24);
    expect(summary.mismatches).toBe(0);
    expect(mismatches).toHaveLength(0);
  });
});
