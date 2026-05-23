import { describe, expect, it } from 'vitest';
import {
  bloomAdd,
  bloomMaybeHas,
  createBloomFilter,
  deserializeBloomFilter,
  serializeBloomFilter,
} from '../../src/utils/bloom-filter.js';

describe('bloom-filter', () => {
  it('adds and tests membership', () => {
    const filter = createBloomFilter({ expectedItems: 100 });
    bloomAdd(filter, 'sig-abc');
    expect(bloomMaybeHas(filter, 'sig-abc')).toBe(true);
    expect(bloomMaybeHas(filter, 'sig-missing')).toBe(false);
  });

  it('round-trips serialization', () => {
    const filter = createBloomFilter({ expectedItems: 50 });
    bloomAdd(filter, 'x');
    bloomAdd(filter, 'y');
    const raw = serializeBloomFilter(filter);
    const restored = deserializeBloomFilter(raw);
    expect(bloomMaybeHas(restored, 'x')).toBe(true);
    expect(bloomMaybeHas(restored, 'y')).toBe(true);
  });
});
