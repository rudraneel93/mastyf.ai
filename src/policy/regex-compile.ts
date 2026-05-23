/**
 * Safe policy regex compilation — YAML escape normalization + ReDoS hardening.
 */
import { MAX_POLICY_REGEX_SOURCE_LEN } from '../utils/eval-bounds.js';
import { Logger } from '../utils/logger.js';

const REGEX_EVAL_TIMEOUT_MS = parseInt(
  process.env.GUARDIAN_REGEX_EVAL_TIMEOUT_MS || '50',
  10,
);

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

/** Run regex.test with bounded input length and wall-clock budget. */
export function safeRegexTest(regex: RegExp, value: string, maxChars: number): boolean {
  const input = value.length > maxChars ? value.slice(0, maxChars) : value;
  const start = Date.now();
  try {
    const matched = regex.test(input);
    const elapsed = Date.now() - start;
    if (elapsed > REGEX_EVAL_TIMEOUT_MS) {
      Logger.warn(
        `[policy] Regex eval exceeded ${REGEX_EVAL_TIMEOUT_MS}ms (${elapsed}ms) — treating as non-match`,
      );
      return false;
    }
    return matched;
  } catch (e) {
    Logger.warn(`[policy] Regex eval error: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}
