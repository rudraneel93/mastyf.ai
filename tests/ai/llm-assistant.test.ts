import { describe, expect, it } from 'vitest';
import { resolveOllamaBaseUrl } from '../../src/ai/llm-assistant.js';

describe('llm-assistant endpoint resolution', () => {
  it('normalizes explicit URL and trims trailing slash', () => {
    expect(resolveOllamaBaseUrl('http://localhost:11434/')).toBe('http://localhost:11434');
  });

  it('uses OLLAMA_BASE_URL env when explicit is missing', () => {
    const prev = process.env.OLLAMA_BASE_URL;
    try {
      process.env.OLLAMA_BASE_URL = '127.0.0.1:11434/';
      expect(resolveOllamaBaseUrl()).toBe('http://127.0.0.1:11434');
    } finally {
      if (prev === undefined) delete process.env.OLLAMA_BASE_URL;
      else process.env.OLLAMA_BASE_URL = prev;
    }
  });

  it('falls back to 127.0.0.1 default for invalid values', () => {
    expect(resolveOllamaBaseUrl('::://bad-url')).toBe('http://127.0.0.1:11434');
  });
});
