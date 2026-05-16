/**
 * Post-hoc LLM semantic audit — non-blocking queue for tools/call.
 * Sync path stays regex/semantic-guards only; LLM runs after JSON-RPC returns.
 */
import { LlmAssistant } from './llm-assistant.js';
import { Logger } from '../utils/logger.js';
import { StructuredLogger } from '../utils/structured-logger.js';
import type { CallContext, PolicyDecision } from '../policy/policy-types.js';

export interface SemanticAuditJob {
  requestId: string | number;
  serverName: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  syncDecision: PolicyDecision;
  timestamp: string;
}

export interface SemanticAuditResult {
  suspicious: boolean;
  confidence: number;
  categories: string[];
  reasoning: string;
}

const DEBOUNCE_MS = parseInt(process.env.GUARDIAN_SEMANTIC_DEBOUNCE_MS || '500', 10);
const queue: SemanticAuditJob[] = [];
let processing = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let llm: LlmAssistant | null = null;

export function isSemanticAsyncEnabled(): boolean {
  if (process.env.GUARDIAN_SEMANTIC_ASYNC === 'false') return false;
  if (process.env.GUARDIAN_SEMANTIC_ASYNC === 'true') return true;
  // Default on when local LLM layer is enabled
  return process.env.GUARDIAN_LLM_ENABLED !== 'false';
}

function getLlm(): LlmAssistant {
  if (!llm) llm = new LlmAssistant();
  return llm;
}

/**
 * Enqueue async semantic audit (debounced batch drain). Never blocks the caller.
 */
export function enqueueSemanticAudit(job: SemanticAuditJob): void {
  if (!isSemanticAsyncEnabled()) return;
  if (!getLlm().isAvailable()) return;

  queue.push(job);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void drainQueue();
  }, DEBOUNCE_MS);
}

async function drainQueue(): Promise<void> {
  if (processing || queue.length === 0) return;
  processing = true;
  const batch = queue.splice(0, queue.length);
  try {
    for (const job of batch) {
      await runAudit(job);
    }
  } finally {
    processing = false;
    if (queue.length > 0) {
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void drainQueue();
      }, DEBOUNCE_MS);
    }
  }
}

async function runAudit(job: SemanticAuditJob): Promise<void> {
  const argsPreview = JSON.stringify(job.arguments ?? {}).slice(0, 2000);
  const systemPrompt = `You are an MCP security analyst. Classify whether a tools/call is suspicious AFTER sync policy passed.
Respond ONLY with JSON: {"suspicious":boolean,"confidence":0-1,"categories":string[],"reasoning":"one sentence"}
Categories: prompt-injection, exfiltration, privilege-escalation, encoded-payload, none.`;

  const userPrompt =
    `Server: ${job.serverName}\nTool: ${job.toolName}\nSync decision: ${job.syncDecision.action} (${job.syncDecision.rule})\nArguments: ${argsPreview}`;

  const response = await getLlm().generate(systemPrompt, userPrompt);
  if (!response) return;

  let result: SemanticAuditResult;
  try {
    const parsed = JSON.parse(response.text) as Partial<SemanticAuditResult>;
    result = {
      suspicious: Boolean(parsed.suspicious),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      reasoning: String(parsed.reasoning || ''),
    };
  } catch {
    Logger.debug('[async-semantic] Failed to parse LLM JSON');
    return;
  }

  if (!result.suspicious || result.confidence < 0.6) return;

  const auditPayload = {
    event: 'async_semantic_flag' as const,
    requestId: job.requestId,
    serverName: job.serverName,
    toolName: job.toolName,
    syncDecision: job.syncDecision,
    semanticAudit: result,
    model: response.model,
    durationMs: response.durationMs,
    timestamp: job.timestamp,
  };

  StructuredLogger.info(auditPayload);
}

/** Build job from proxy context after sync policy evaluation. */
export function buildSemanticAuditJob(
  ctx: CallContext,
  syncDecision: PolicyDecision,
): SemanticAuditJob {
  return {
    requestId: ctx.requestId ?? 'unknown',
    serverName: ctx.serverName,
    toolName: ctx.toolName,
    arguments: ctx.arguments,
    syncDecision,
    timestamp: ctx.timestamp ?? new Date().toISOString(),
  };
}
