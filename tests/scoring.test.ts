import { describe, it, expect } from 'vitest';
import { calculateOverallScore } from '../src/utils/scoring.js';

describe('calculateOverallScore', () => {
  it('returns average of security and health', () => {
    const score = calculateOverallScore(
      [{ score: 80 }],
      [{ successRate: 0.9 }]
    );
    expect(score).toBe(85); // (80 + 90) / 2
  });

  it('returns 0 when both arrays are empty', () => {
    expect(calculateOverallScore([], [])).toBe(0);
  });

  it('returns security average when health is empty', () => {
    const score = calculateOverallScore(
      [{ score: 70 }, { score: 90 }],
      []
    );
    expect(score).toBe(80); // (70 + 90) / 2
  });

  it('returns health average when security is empty', () => {
    const score = calculateOverallScore(
      [],
      [{ successRate: 0.5 }, { successRate: 1.0 }]
    );
    expect(score).toBe(75); // ((0.5*100) + (1.0*100)) / 2 = (50 + 100) / 2
  });

  it('rounds to nearest integer', () => {
    const score = calculateOverallScore(
      [{ score: 77 }],
      [{ successRate: 0.85 }]
    );
    // (77 + 85) / 2 = 81 — already integer
    expect(score).toBe(81);
  });

  it('handles multiple servers', () => {
    const score = calculateOverallScore(
      [{ score: 50 }, { score: 100 }, { score: 0 }],
      [{ successRate: 1.0 }, { successRate: 0.5 }]
    );
    // Security avg: (50 + 100 + 0) / 3 = 50
    // Health avg: (100 + 50) / 2 = 75
    // Overall: (50 + 75) / 2 = 62.5 → 63
    expect(score).toBe(63);
  });
});