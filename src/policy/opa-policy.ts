/**
 * Optional OPA/Rego policy evaluation (enterprise).
 * Enable with: OPA_URL=http://localhost:8181/v1/data/mcp_guardian
 */
import { CallContext, PolicyDecision } from './policy-types.js';
import { Logger } from '../utils/logger.js';

export async function evaluateOpaPolicy(ctx: CallContext): Promise<PolicyDecision | null> {
  const opaUrl = process.env['OPA_URL'];
  if (!opaUrl) return null;

  try {
    const res = await fetch(opaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: ctx }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      Logger.warn(`[opa] evaluation failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { result?: { allow?: boolean; reason?: string } };
    if (data.result?.allow === false) {
      return { action: 'block', rule: 'opa', reason: data.result.reason || 'Denied by OPA policy' };
    }
    if (data.result?.allow === true) {
      return { action: 'pass', rule: 'opa', reason: 'Allowed by OPA policy' };
    }
  } catch (err: any) {
    Logger.warn(`[opa] unreachable: ${err?.message}`);
    if (process.env['GUARDIAN_STRICT_MODE'] === 'true') {
      return { action: 'block', rule: 'opa', reason: 'OPA unreachable in strict mode' };
    }
  }
  return null;
}
