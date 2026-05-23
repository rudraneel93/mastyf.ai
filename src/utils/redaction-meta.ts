/** Attach redaction metadata to MCP tool results (stdio JSON-RPC). */
export function injectRedactionMeta(
  result: unknown,
  reasons?: string[],
): unknown {
  if (!reasons?.length || result == null || typeof result !== 'object') return result;
  const r = result as Record<string, unknown>;
  const prev = (r._meta && typeof r._meta === 'object' ? r._meta : {}) as Record<string, unknown>;
  return {
    ...r,
    _meta: {
      ...prev,
      redaction: { reasons: reasons.slice(0, 8) },
    },
  };
}

export function formatRedactionHeader(reasons?: string[]): string | undefined {
  if (!reasons?.length) return undefined;
  return reasons.slice(0, 5).join(', ');
}
