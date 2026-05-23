import { describe, expect, it } from 'vitest';
import {
  computeComparison,
  fillTimeSeries,
  generateTimeBuckets,
  parseWindowDays,
  windowRangeMs,
} from '../../src/utils/time-buckets.js';

describe('time-buckets', () => {
  it('parseWindowDays accepts d suffix and numbers', () => {
    expect(parseWindowDays('7d')).toBe(7);
    expect(parseWindowDays('30d')).toBe(30);
    expect(parseWindowDays(14)).toBe(14);
    expect(parseWindowDays('bad', 7)).toBe(7);
  });

  it('generateTimeBuckets fills hourly range', () => {
    const start = Date.parse('2025-01-01T10:00:00.000Z');
    const end = Date.parse('2025-01-01T13:00:00.000Z');
    const buckets = generateTimeBuckets(start, end, 'hour');
    expect(buckets).toHaveLength(4);
    expect(buckets[0]).toBe('2025-01-01T10:00:00.000Z');
  });

  it('fillTimeSeries zero-fills and detects sparse data', () => {
    const buckets = ['a', 'b', 'c', 'd'];
    const raw = [{ bucket: 'b', count: 5 }];
    const result = fillTimeSeries(raw, 'bucket', buckets, ['count']);
    expect(result.points).toHaveLength(4);
    expect(result.points[0].count).toBe(0);
    expect(result.points[1].count).toBe(5);
    expect(result.sparse).toBe(true);
    expect(result.totalValue).toBe(5);
  });

  it('computeComparison handles zero prior', () => {
    const c = computeComparison(10, 0);
    expect(c.deltaPct).toBeNull();
    expect(c.deltaAbs).toBe(10);
    expect(c.direction).toBe('up');
  });

  it('windowRangeMs returns prior window', () => {
    const now = Date.parse('2025-05-23T12:00:00.000Z');
    const { startMs, priorStartMs, priorEndMs } = windowRangeMs(7, now);
    expect(startMs).toBe(now - 7 * 86_400_000);
    expect(priorEndMs).toBe(startMs);
    expect(priorStartMs).toBe(startMs - 7 * 86_400_000);
  });
});
