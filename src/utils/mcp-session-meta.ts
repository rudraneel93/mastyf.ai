/** Inject rotated MCP session token into JSON-RPC tool result _meta. */
export function injectRotatedSessionIntoResult(
  msg: Record<string, unknown>,
  rotatedToken: string | undefined,
): void {
  if (!rotatedToken || !msg.result || typeof msg.result !== 'object') return;
  const result = msg.result as Record<string, unknown>;
  const meta = (result._meta as Record<string, unknown> | undefined) ?? {};
  meta.sessionToken = rotatedToken;
  result._meta = meta;
}
