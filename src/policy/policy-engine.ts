import { PolicyConfig, PolicyDecision, CallContext, PolicyAction, PolicyMode } from './policy-types.js';
import { Logger } from '../utils/logger.js';

/**
 * Policy Engine — evaluates every intercepted tools/call against configured rules.
 * Supports three modes: audit (passive), warn (flag only), block (active enforcement).
 */
export class PolicyEngine {
  private rules: PolicyConfig['policy']['rules'];
  private mode: PolicyMode;
  private callCounters: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(config: PolicyConfig) {
    this.rules = config.policy.rules;
    this.mode = config.policy.mode;
  }

  /**
   * Evaluate a tools/call request and return a decision.
   */
  evaluate(context: CallContext): PolicyDecision {
    for (const rule of this.rules) {
      const decision = this.evaluateRule(rule, context);
      if (decision) return decision;
    }

    // Default: pass
    return { action: 'pass', rule: 'default', reason: 'No policy rules matched' };
  }

  private evaluateRule(rule: PolicyConfig['policy']['rules'][number], ctx: CallContext): PolicyDecision | null {
    // Tool allowlist/denylist
    if (rule.tools) {
      if (rule.tools.allow && rule.tools.allow.length > 0) {
        if (!rule.tools.allow.includes(ctx.toolName)) {
          return { action: this.resolveAction(rule.action), rule: rule.name, reason: `Tool '${ctx.toolName}' not in allowlist: [${rule.tools.allow.join(', ')}]` };
        }
      }
      if (rule.tools.deny && rule.tools.deny.length > 0) {
        if (rule.tools.deny.includes(ctx.toolName)) {
          return { action: this.resolveAction(rule.action), rule: rule.name, reason: `Tool '${ctx.toolName}' is explicitly denied` };
        }
      }
    }

    // Malicious pattern detection
    if (rule.patterns) {
      const argsStr = ctx.arguments ? JSON.stringify(ctx.arguments) : '';
      for (const pattern of rule.patterns) {
        try {
          if (new RegExp(pattern).test(argsStr)) {
            return { action: this.resolveAction(rule.action), rule: rule.name, reason: `Argument pattern '${pattern}' matched in tool call` };
          }
        } catch {
          Logger.warn(`Policy: invalid regex pattern in rule '${rule.name}': ${pattern}`);
        }
      }
    }

    // Max tokens per call
    if (rule.maxTokens && ctx.requestTokens > rule.maxTokens) {
      return { action: this.resolveAction(rule.action), rule: rule.name, reason: `Token count ${ctx.requestTokens} exceeds max ${rule.maxTokens}` };
    }

    // Rate limiting
    if (rule.maxCallsPerMinute) {
      const key = `${ctx.serverName}:${ctx.toolName}`;
      const now = Date.now();
      let counter = this.callCounters.get(key);
      if (!counter || now > counter.resetAt) {
        counter = { count: 1, resetAt: now + 60000 };
        this.callCounters.set(key, counter);
      } else {
        counter.count++;
        if (counter.count > rule.maxCallsPerMinute) {
          return { action: this.resolveAction(rule.action), rule: rule.name, reason: `Rate limit exceeded: ${counter.count}/${rule.maxCallsPerMinute} calls per minute` };
        }
      }
    }

    return null;
  }

  private resolveAction(ruleAction: PolicyAction): PolicyAction {
    if (this.mode === 'audit') return 'pass';
    if (this.mode === 'warn' && ruleAction === 'block') return 'flag';
    return ruleAction;
  }

  getMode(): PolicyMode {
    return this.mode;
  }
}