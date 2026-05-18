import { describe, it, expect } from 'vitest';
import {
  TokenCounter,
  countAudioTokensInPayload,
  estimateAudioTokens,
} from '../../src/utils/token-counter.js';

describe('multimodal audio tokens', () => {
  it('estimates tokens from duration seconds', () => {
    expect(estimateAudioTokens(60)).toBe(1500);
    expect(estimateAudioTokens(0)).toBe(0);
  });

  it('includes audio tokens in proxy call totals', () => {
    const payload = {
      method: 'tools/call',
      params: {
        name: 'transcribe',
        arguments: {
          audio: { type: 'input_audio', duration_seconds: 120 },
        },
        _meta: { model: 'whisper-1' },
      },
    };
    const audioTokens = countAudioTokensInPayload(payload);
    expect(audioTokens).toBeGreaterThan(0);

    const counter = new TokenCounter();
    const withAudio = counter.countProxyCall({
      requestText: JSON.stringify(payload),
      responseText: '{"result":{}}',
      model: 'whisper-1',
      requestPayload: payload,
    });
    expect(withAudio.audioTokens).toBe(audioTokens);
    expect(withAudio.requestTokens).toBeGreaterThanOrEqual(audioTokens);
    counter.free();
  });
});
