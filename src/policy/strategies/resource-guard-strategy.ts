import { evaluateResourceGuard } from '../resource-guard.js';
import type { PolicyStrategy } from './types.js';

export const resourceGuardStrategy: PolicyStrategy = {
  name: 'resource-guard',
  evaluate({ normalized, argsStr }, deps) {
    const decision = evaluateResourceGuard(normalized, argsStr);
    if (!decision) return null;
    return { ...decision, action: deps.resolveAction(decision.action) };
  },
};
