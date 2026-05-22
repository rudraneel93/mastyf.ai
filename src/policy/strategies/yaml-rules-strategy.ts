import type { PolicyDecision } from '../policy-types.js';
import type { PolicyStrategy } from './types.js';

export const yamlRulesStrategy: PolicyStrategy = {
  name: 'yaml-rules',
  evaluate({ raw, normalized, argsStr, skipLocalRateLimit }, deps) {
    let permittedByAllowlist = false;
    for (const rule of deps.rules) {
      if (rule.tools?.allow?.length && rule.tools.allow.includes(normalized.toolName)) {
        permittedByAllowlist = true;
      }
      const decision = deps.evaluateRule(
        rule,
        normalized,
        { argsStr, raw },
        skipLocalRateLimit,
      );
      if (decision) return decision;
    }

    if (permittedByAllowlist) {
      return {
        action: 'pass',
        rule: 'allowlist',
        reason: `Tool '${normalized.toolName}' is allowlisted and passed policy checks`,
      };
    }

    const defaultAction = deps.config.policy.default_action ?? 'pass';
    return {
      action: deps.resolveAction(defaultAction),
      rule: 'default',
      reason: `No matching rule — applying default_action: ${defaultAction}`,
    };
  },
};
