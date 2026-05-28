import { describe, expect, it } from 'vitest';
import {
  classifySemanticRiskTier,
  shouldFailClosedOnSemanticDegrade,
} from '../../src/ai/semantic-risk-tier.js';

describe('semantic-risk-tier', () => {
  it('classifies high-risk tools', () => {
    expect(classifySemanticRiskTier('execute_command', {})).toBe('high');
  });

  it('classifies low-risk by default', () => {
    expect(classifySemanticRiskTier('list_directory', {})).toBe('low');
  });

  it('fails closed for high-risk by default', () => {
    expect(shouldFailClosedOnSemanticDegrade('high')).toBe(true);
  });
});
