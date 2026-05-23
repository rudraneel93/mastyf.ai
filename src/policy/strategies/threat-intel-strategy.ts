import { evaluateThreatIntelGuard } from '../threat-intel-guard.js';
import type { PolicyStrategy } from './types.js';

export const threatIntelStrategy: PolicyStrategy = {
  name: 'threat-intel',
  evaluate({ normalized }, deps) {
    const decision = evaluateThreatIntelGuard(normalized);
    if (!decision) return null;
    return { ...decision, action: deps.resolveAction(decision.action) };
  },
};
