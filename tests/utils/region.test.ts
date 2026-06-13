import { describe, it, expect, afterEach } from 'vitest';
import { getMastyfAiRegion, getMastyfAiRegionLabels } from '../../src/utils/region.js';

describe('region', () => {
  const prev = process.env.MASTYF_AI_REGION;

  afterEach(() => {
    if (prev === undefined) delete process.env.MASTYF_AI_REGION;
    else process.env.MASTYF_AI_REGION = prev;
  });

  it('defaults to default when unset', () => {
    delete process.env.MASTYF_AI_REGION;
    expect(getMastyfAiRegion()).toBe('default');
  });

  it('reads MASTYF_AI_REGION', () => {
    process.env.MASTYF_AI_REGION = 'eu-west-1';
    expect(getMastyfAiRegionLabels()).toEqual({ region: 'eu-west-1' });
  });
});
