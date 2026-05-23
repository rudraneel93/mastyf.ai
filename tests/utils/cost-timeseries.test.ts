import { describe, expect, it } from 'vitest';
import { pivotCostTimeseries } from '../../src/utils/cost-timeseries.js';

describe('pivotCostTimeseries', () => {
  it('pivots series into chart rows', () => {
    const rows = pivotCostTimeseries([
      { bucket: '2026-05-01T00:00:00.000Z', server: 'a', costUsd: 1, calls: 2 },
      { bucket: '2026-05-01T00:00:00.000Z', server: 'b', costUsd: 2, calls: 1 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(3);
    expect(rows[0].a).toBe(1);
    expect(rows[0].b).toBe(2);
  });
});
