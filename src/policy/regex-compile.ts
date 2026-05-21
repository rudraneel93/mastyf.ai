/**
 * Safe policy regex compilation — YAML escape normalization + ReDoS hardening.
 */
import { MAX_POLICY_REGEX_SOURCE_LEN } from '../utils/eval-bounds.js';
import { Logger } from '../utils/logger.js';

/** Normalize YAML-escaped policy patterns before RegExp construction. */
export function normalizePolicyRegexSource(pattern: string): string {
  return pattern.includes('\\\\') ? pattern.replace(/\\\\/g, '\\') : pattern;
}

/** Patterns associated with catastrophic backtracking when applied to large inputs. */
const REDOS_RISK =
  /(\([^)]*[+*][^)]*\)[+*{])|(\(\?[^)]*\)[+*{])|(\.\*){2,}|(\.\+){2,}|(\[[^\]]*[+*]{2,})|(\([^)]*\|[^)]*\)[+*])/;

export function isRegexPatternSafe(pattern: string): { safe: boolean; reason?: string } {
  const normalized = normalizePolicyRegexSource(pattern);
  if (normalized.length > MAX_POLICY_REGEX_SOURCE_LEN) {
    return { safe: false, reason: `Pattern exceeds ${MAX_POLICY_REGEX_SOURCE_LEN} characters` };
  }
  if (REDOS_RISK.test(normalized)) {
    return { safe: false, reason: 'Nested/greedy quantifier ReDoS risk' };
  }
  try {
    new RegExp(normalized, 'i');
  } catch (e) {
    return { safe: false, reason: e instanceof Error ? e.message : 'Invalid regex' };
  }
  return { safe: true };
}

export function compilePolicyRegex(pattern: string, flags = 'i'): RegExp {
  const check = isRegexPatternSafe(pattern);
  if (!check.safe) {
    Logger.warn(`Policy: rejecting unsafe regex — ${check.reason}: ${pattern.slice(0, 80)}`);
    return /(?!)/;
  }
  return new RegExp(normalizePolicyRegexSource(pattern), flags);
}

/** Run regex.test with bounded input length. */
export function safeRegexTest(regex: RegExp, value: string, maxChars: number): boolean {
  const input = value.length > maxChars ? value.slice(0, maxChars) : value;
  return regex.test(input);
}
