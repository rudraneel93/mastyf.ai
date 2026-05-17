import { describe, it, expect, afterEach } from 'vitest';
import { getGuardianRegion, getGuardianRegionLabels } from '../../src/utils/region.js';

describe('region', () => {
  const prev = process.env.GUARDIAN_REGION;

  afterEach(() => {
    if (prev === undefined) delete process.env.GUARDIAN_REGION;
    else process.env.GUARDIAN_REGION = prev;
  });

  it('defaults to default when unset', () => {
    delete process.env.GUARDIAN_REGION;
    expect(getGuardianRegion()).toBe('default');
  });

  it('reads GUARDIAN_REGION', () => {
    process.env.GUARDIAN_REGION = 'eu-west-1';
    expect(getGuardianRegionLabels()).toEqual({ region: 'eu-west-1' });
  });
});
