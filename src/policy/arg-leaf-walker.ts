/**
 * Recursively walk all string leaves in nested tool call arguments.
 * Shared by prompt-injection, SQL/SSRF/path/base64 guards.
 */
export interface StringLeaf {
  path: string;
  value: string;
}

export function walkStringLeaves(obj: unknown, prefix = ''): StringLeaf[] {
  if (typeof obj === 'string') {
    return [{ path: prefix || '$', value: obj }];
  }
  if (obj === null || obj === undefined) return [];
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return [{ path: prefix || '$', value: String(obj) }];
  }
  if (Array.isArray(obj)) {
    return obj.flatMap((item, i) =>
      walkStringLeaves(item, prefix ? `${prefix}[${i}]` : `[${i}]`),
    );
  }
  if (typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([key, val]) =>
      walkStringLeaves(val, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [{ path: prefix || '$', value: String(obj) }];
}

/** Collect decoded string values from all argument leaves. */
export function collectStringLeafValues(obj: unknown): string[] {
  return walkStringLeaves(obj).map((l) => l.value);
}
