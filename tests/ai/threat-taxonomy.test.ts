import { describe, expect, it } from 'vitest';
import {
  categoryFromAttackClass,
  categoryFromBlockRule,
  categoryFromSemanticCategories,
  attackClassFromBlockRule,
  normalizeAttackClassSlug,
  normalizeDiscoveryClassification,
  CORPUS_CATEGORIES,
} from '../../src/ai/threat-taxonomy.js';
import type { ThreatLabDiscovery } from '../../src/ai/threat-lab.js';

describe('threat-taxonomy', () => {
  it('normalizes attack class slugs', () => {
    expect(normalizeAttackClassSlug('  Prompt Injection! ')).toBe('prompt-injection');
    expect(normalizeAttackClassSlug('')).toBe('');
  });

  it('maps block rules to corpus categories', () => {
    expect(categoryFromBlockRule('secret-scan')).toBe('credential-exfil');
    expect(categoryFromBlockRule('unknown-rule')).toBe('prompt-injection');
  });

  it('maps block rules to attack class slugs', () => {
    expect(attackClassFromBlockRule('secret-scan')).toBe('secret-exfil');
    expect(attackClassFromBlockRule('semantic-shell-guard')).toBe('prompt-injection');
    expect(attackClassFromBlockRule('unknown-rule')).toBe('prompt-injection');
  });

  it('maps semantic categories', () => {
    expect(categoryFromSemanticCategories(['exfiltration'])).toBe('credential-exfil');
    expect(categoryFromSemanticCategories(['encoded-payload'])).toBe('shell-obfuscation');
  });

  it('maps attack class hints', () => {
    expect(categoryFromAttackClass('cve-nvd-2024-shell')).toBe('shell-obfuscation');
    expect(categoryFromAttackClass('ghsa-token-leak')).toBe('credential-exfil');
  });

  it('normalizes discovery classification', () => {
    const discovery: ThreatLabDiscovery = {
      attackClass: 'Prompt Injection Test',
      hypothesis: 'test',
      corpusCandidate: {
        id: 't1',
        toolName: 'search',
        arguments: { q: 'x' },
        expected: 'block',
        category: 'invalid-category',
      },
      policyRule: { name: 'r1', action: 'block', patterns: ['x'] },
      confidence: 0.9,
    };
    const normalized = normalizeDiscoveryClassification(discovery);
    expect(normalized.attackClass).toBe('prompt-injection-test');
    expect(CORPUS_CATEGORIES).toContain(normalized.corpusCandidate.category);
  });
});
