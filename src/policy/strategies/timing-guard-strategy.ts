import { evaluateTimingGuard } from '../timing-guard.js';
import type { PolicyStrategy } from './types.js';

export const timingGuardStrategy: PolicyStrategy = {
  name: 'timing-guard',
  evaluate({ normalized }, deps) {
    const decision = evaluateTimingGuard(normalized);
    if (!decision) return null;
    return { ...decision, action: deps.resolveAction(decision.action) };
  },
};
