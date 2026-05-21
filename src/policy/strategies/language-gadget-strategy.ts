import { evaluateLanguageGadgetGuard } from '../language-gadget-guard.js';
import type { PolicyStrategy } from './types.js';

export const languageGadgetStrategy: PolicyStrategy = {
  name: 'language-gadget',
  evaluate({ normalized }, deps) {
    const decision = evaluateLanguageGadgetGuard(normalized);
    if (!decision) return null;
    return { ...decision, action: deps.resolveAction(decision.action) };
  },
};
