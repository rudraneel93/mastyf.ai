import { evaluateShadowPolicy } from '../shadow-policy.js';
import type { CallContext } from '../policy-types.js';

/** Fire-and-forget shadow policy comparison (never blocks). */
export function runShadowPolicy(context: CallContext): void {
  void evaluateShadowPolicy(context);
}
