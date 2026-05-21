/**
 * Compile regex patterns from default-policy.yaml (YAML escaping uses doubled backslashes).
 */

/** Normalize YAML-escaped policy patterns before RegExp construction. */
export function normalizePolicyRegexSource(pattern: string): string {
  return pattern.includes('\\\\') ? pattern.replace(/\\\\/g, '\\') : pattern;
}

export function compilePolicyRegex(pattern: string, flags = 'i'): RegExp {
  return new RegExp(normalizePolicyRegexSource(pattern), flags);
}
