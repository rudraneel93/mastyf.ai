import { describe, it, expect } from 'vitest';
import { normalizeDpopUri } from '../../src/auth/dpop.js';

describe('normalizeDpopUri', () => {
  it('strips fragment and trailing slash', () => {
    expect(normalizeDpopUri('https://api.example.com/mcp/tools/#frag')).toBe(
      'https://api.example.com/mcp/tools',
    );
    expect(normalizeDpopUri('https://api.example.com/mcp/tools/')).toBe(
      'https://api.example.com/mcp/tools',
    );
  });
});
