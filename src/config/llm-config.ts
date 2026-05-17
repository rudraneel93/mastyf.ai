export type LlmProvider = 'anthropic' | 'openai' | 'ollama';

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl: string;
  maxTokens: number;
  timeoutMs: number;
  temperature: number;
  enabled: boolean;
}

let cached: LlmConfig | null = null;

function resolveProvider(): LlmProvider {
  const explicit = process.env.GUARDIAN_LLM_PROVIDER?.toLowerCase();
  if (explicit === 'anthropic' || explicit === 'openai' || explicit === 'ollama') {
    return explicit;
  }
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'ollama';
}

function defaultModelForProvider(provider: LlmProvider): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-haiku-4-5-20251001';
    case 'openai':
      return 'gpt-4o-mini';
    case 'ollama':
      return 'qwen3:8b';
  }
}

/** Centralized LLM settings — read env once per process. */
export function getLlmConfig(): LlmConfig {
  if (cached) return cached;

  const provider = resolveProvider();
  const model = process.env.GUARDIAN_LLM_MODEL || defaultModelForProvider(provider);

  cached = {
    provider,
    model,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    ollamaBaseUrl:
      process.env.OLLAMA_BASE_URL ||
      process.env.OLLAMA_URL ||
      'http://localhost:11434',
    maxTokens: parseInt(process.env.GUARDIAN_LLM_MAX_TOKENS || '512', 10),
    timeoutMs: parseInt(process.env.GUARDIAN_LLM_TIMEOUT_MS || '30000', 10),
    temperature: parseFloat(process.env.GUARDIAN_LLM_TEMPERATURE || '0.1'),
    enabled: process.env.GUARDIAN_LLM_ENABLED !== 'false',
  };
  return cached;
}

export function resetLlmConfigForTests(): void {
  cached = null;
}

/** Resolve model id from call payload, legacy env vars, or centralized config. */
export function resolveModelId(payloadModel?: string | null): string {
  return (
    payloadModel ||
    process.env.GUARDIAN_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.MCP_PRICING_MODEL ||
    getLlmConfig().model
  );
}
