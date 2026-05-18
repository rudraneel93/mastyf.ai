import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startMemoryMonitor } from '../../src/utils/memory-monitor.js';

describe('startMemoryMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a stop function that clears the interval', () => {
    const stop = startMemoryMonitor({ intervalMs: 1000, warnHeapMb: 99999 });
    expect(() => stop()).not.toThrow();
  });

  it('samples on interval without throwing', () => {
    const stop = startMemoryMonitor({ intervalMs: 1000, warnHeapMb: 99999 });
    vi.advanceTimersByTime(3000);
    stop();
  });
});
