import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeUnicode } from '../../src/utils/confusables.js';
import { PayloadNormalizer } from '../../src/utils/payload-normalizer.js';

interface SuiteVariant {
  input: string;
  category: string;
  expectMatch: boolean;
}

interface SuiteFixture {
  description: string;
  variants: SuiteVariant[];
}

const SUITE_PATH = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/confusables-suite.json');
const suite: SuiteFixture = JSON.parse(readFileSync(SUITE_PATH, 'utf8'));

const PATTERNS: Record<string, RegExp> = {
  curl: /curl/i,
  greek: /curl/i,
  math: /curl/i,
  wget: /wget/i,
  rm: /rm\s+-rf/i,
  'pipe-sh': /\|\s*sh/i,
  bash: /bash\s+-i/i,
  armenian: /w.*get|wget/i,
  cyrillic: /rm|sh|auto/i,
  ascii: /curl/i,
  'small-caps': /cat/i,
  benign: /node/,
};

describe('confusables-suite.json', () => {
  it('loads fixture with expected variant count', () => {
    expect(suite.variants.length).toBeGreaterThanOrEqual(70);
  });

  it('detects confusable shell commands after TR39 normalization', () => {
    const failures: { input: string; category: string; normalized: string }[] = [];
    let detected = 0;
    let expectedDetect = 0;

    for (const variant of suite.variants) {
      const pattern = PATTERNS[variant.category];
      if (!pattern) continue;

      const normalized = normalizeUnicode(variant.input);
      const matches = pattern.test(normalized);

      if (variant.expectMatch) {
        expectedDetect++;
        if (matches) detected++;
        else failures.push({ input: variant.input, category: variant.category, normalized });
      } else if (matches) {
        failures.push({ input: variant.input, category: variant.category, normalized });
      }
    }

    const rate = expectedDetect > 0 ? (detected / expectedDetect) * 100 : 0;
    expect(
      detected,
      `Detection ${detected}/${expectedDetect} (${rate.toFixed(1)}%). Failures: ${JSON.stringify(failures.slice(0, 5), null, 2)}`,
    ).toBeGreaterThanOrEqual(Math.floor(expectedDetect * 0.9));

    // Log rate for CI / manual inspection
    if (failures.length > 0) {
      console.log(
        `confusables-suite: ${detected}/${expectedDetect} (${rate.toFixed(1)}%), ${failures.length} misses`,
      );
    }
  });

  it('unicode_strict:false skips TR39 but keeps NFKC/math decomposition', () => {
    const greekCurl = suite.variants.find((v) => v.category === 'greek');
    expect(greekCurl).toBeDefined();

    const strict = new PayloadNormalizer(5, 1_000_000, true).normalize(greekCurl!.input).normalized;
    const loose = new PayloadNormalizer(5, 1_000_000, false).normalize(greekCurl!.input).normalized;
    expect(/curl/i.test(strict)).toBe(true);
    expect(/curl/i.test(loose)).toBe(false);
  });
});
