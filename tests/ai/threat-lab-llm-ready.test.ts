import { describe, expect, it } from 'vitest';
import { ensureThreatLabLlmReady } from '../../src/ai/threat-lab.js';
import type { LlmAssistant } from '../../src/ai/llm-assistant.js';

function fakeAssistant(input: {
  available: boolean;
  outcomes: Array<{ ok: boolean; reason?: string }>;
  endpoint: string;
}): LlmAssistant {
  let idx = 0;
  return {
    isAvailable: () => input.available,
    healthCheckDetailed: async () => {
      const row = input.outcomes[Math.min(idx, input.outcomes.length - 1)]!;
      idx += 1;
      return { ...row, endpoint: input.endpoint };
    },
    getOllamaUrl: () => input.endpoint,
  } as unknown as LlmAssistant;
}

describe('ensureThreatLabLlmReady', () => {
  it('succeeds when health turns green after retry', async () => {
    const llm = fakeAssistant({
      available: true,
      outcomes: [{ ok: false, reason: 'connect' }, { ok: true }],
      endpoint: 'http://127.0.0.1:11434',
    });
    const ready = await ensureThreatLabLlmReady(llm);
    expect(ready.ok).toBe(true);
    expect(ready.reason).toBeUndefined();
  });

  it('returns reason with endpoint after bounded retries fail', async () => {
    const llm = fakeAssistant({
      available: true,
      outcomes: [{ ok: false, reason: 'timeout' }],
      endpoint: 'http://127.0.0.1:11434',
    });
    const ready = await ensureThreatLabLlmReady(llm);
    expect(ready.ok).toBe(false);
    expect(ready.reason).toContain('timeout');
    expect(ready.reason).toContain('http://127.0.0.1:11434');
  });
});
