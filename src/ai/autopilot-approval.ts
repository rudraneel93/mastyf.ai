import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import type { PolicyRule } from '../policy/policy-types.js';
import { evaluateAutopilotSafety, type AutopilotProposal } from './autopilot-safety-contract.js';
import { scorePolicyImpact, type PolicyImpactInputs } from './policy-impact-scoring.js';

export interface ApprovalPreviewInput {
  suggestionId: string;
  source: 'baseline' | 'cost' | 'threat' | 'assist' | 'pattern' | 'attack';
  rule: PolicyRule;
  actor: string;
  stage: 'shadow' | 'canary' | 'enforce';
  evidence: PolicyImpactInputs & { canarySizePercent: number; simulationPassed: boolean };
}

export interface ApprovalPreview {
  suggestionId: string;
  ruleName: string;
  actor: string;
  safety: ReturnType<typeof evaluateAutopilotSafety>;
  impact: ReturnType<typeof scorePolicyImpact>;
}

type RollbackLedgerEntry = {
  timestamp: string;
  suggestionId: string;
  ruleName: string;
  actor: string;
  reason: string;
};

const ROLLBACK_LEDGER = join(process.cwd(), 'reports', 'autopilot', 'rollback-ledger.jsonl');

export function buildApprovalPreview(input: ApprovalPreviewInput): ApprovalPreview {
  const proposal: AutopilotProposal = {
    suggestionId: input.suggestionId,
    rule: input.rule,
    source: input.source,
    stage: input.stage,
    evidence: {
      simulationPassed: input.evidence.simulationPassed,
      replayCoverage: input.evidence.replayCoverage,
      confidence: input.evidence.confidence,
      predictedFalsePositiveDelta: input.evidence.predictedFalsePositiveDelta,
      predictedBypassDelta: input.evidence.predictedBypassDelta,
      blastRadiusPercent: input.evidence.blastRadiusPercent,
      rollbackConfidence: input.evidence.rollbackConfidence,
      canarySizePercent: input.evidence.canarySizePercent,
    },
  };
  return {
    suggestionId: input.suggestionId,
    ruleName: input.rule.name,
    actor: input.actor,
    safety: evaluateAutopilotSafety(proposal),
    impact: scorePolicyImpact(input.evidence),
  };
}

export function appendRollbackLedger(entry: Omit<RollbackLedgerEntry, 'timestamp'>): void {
  mkdirSync(dirname(ROLLBACK_LEDGER), { recursive: true });
  const row: RollbackLedgerEntry = { timestamp: new Date().toISOString(), ...entry };
  appendFileSync(ROLLBACK_LEDGER, JSON.stringify(row) + '\n', 'utf-8');
}

export function readRollbackLedger(limit = 50): RollbackLedgerEntry[] {
  if (!existsSync(ROLLBACK_LEDGER)) return [];
  const lines = readFileSync(ROLLBACK_LEDGER, 'utf-8').split('\n').filter(Boolean);
  const out: RollbackLedgerEntry[] = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    try {
      out.push(JSON.parse(lines[i]!) as RollbackLedgerEntry);
    } catch {
      // ignore malformed rows
    }
  }
  return out;
}
