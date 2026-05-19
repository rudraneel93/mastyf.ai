import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker } from '../../src/utils/circuit-breaker.js';

describe('CircuitBreaker HALF_OPEN', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows only one probe in HALF_OPEN until probe completes', () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 1,
      successThreshold: 1,
      resetTimeoutMs: 1000,
    });
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');

    vi.advanceTimersByTime(1000);
    expect(cb.allowRequest()).toBe(true);
    expect(cb.getState()).toBe('HALF_OPEN');
    expect(cb.allowRequest()).toBe(false);
    expect(cb.allowRequest()).toBe(false);

    cb.recordSuccess();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.allowRequest()).toBe(true);
  });

  it('rejects additional callers until failed probe reopens', () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 1,
      successThreshold: 2,
      resetTimeoutMs: 500,
    });
    cb.recordFailure();
    vi.advanceTimersByTime(500);
    expect(cb.allowRequest()).toBe(true);
    expect(cb.allowRequest()).toBe(false);
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
    expect(cb.allowRequest()).toBe(false);
  });
});
