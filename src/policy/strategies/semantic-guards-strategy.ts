import { evaluateSemanticGuards } from '../semantic-guards.js';
import type { CommandRisk } from '../shell-tokenizer.js';
import type { PolicyDecision } from '../policy-types.js';
import type { PolicyStrategy, PolicyEngineDeps, SyncEvaluateContext } from './types.js';

function evaluateSemanticShell(
  shellRisk: CommandRisk,
  toolName: string,
  argsStr: string,
  deps: PolicyEngineDeps,
): PolicyDecision | null {
  if (deps.config.policy.semantic_shell === false) return null;

  const { shellTokenizer, resolveAction } = deps;

  const psReason = shellTokenizer.detectPowerShellRisk(argsStr);
  if (psReason) {
    return {
      action: resolveAction('block'),
      rule: 'semantic-shell-guard',
      reason: psReason,
    };
  }

  const b64ShellReason = shellTokenizer.detectBase64PipeShell(argsStr);
  if (b64ShellReason) {
    return {
      action: resolveAction('block'),
      rule: 'semantic-shell-guard',
      reason: b64ShellReason,
    };
  }

  if (shellRisk.hasCommandSubstitution) {
    return {
      action: resolveAction('block'),
      rule: 'semantic-shell-guard',
      reason: 'Semantic: shell command substitution detected in arguments',
    };
  }

  if (shellRisk.dangerousCommands.length > 0) {
    return {
      action: resolveAction('block'),
      rule: 'semantic-shell-guard',
      reason: `Semantic: dangerous shell commands detected: [${shellRisk.dangerousCommands.join(', ')}]`,
    };
  }

  if (shellRisk.hasPipes && shellRisk.hasCommandSubstitution) {
    return {
      action: resolveAction('block'),
      rule: 'semantic-shell-guard',
      reason: 'Semantic: pipe chain with command substitution',
    };
  }

  void toolName;
  return null;
}

export const semanticGuardsStrategy: PolicyStrategy = {
  name: 'semantic-guards',
  evaluate({ normalized, argsStr }, deps) {
    const shellRisk: CommandRisk = argsStr.length > 0
      ? deps.shellTokenizer.analyzeRisk(
          deps.shellTokenizer.tokenize(argsStr).commands,
        )
      : {
          hasCommandSubstitution: false,
          hasPipes: false,
          hasRedirects: false,
          hasLogicalChains: false,
          dangerousCommands: [],
          shellMetacharacters: [],
        };

    const shellDecision = evaluateSemanticShell(shellRisk, normalized.toolName, argsStr, deps);
    if (shellDecision) return shellDecision;

    const semanticAbuse = evaluateSemanticGuards(normalized);
    if (semanticAbuse) {
      return { ...semanticAbuse, action: deps.resolveAction(semanticAbuse.action) };
    }

    return null;
  },
};
