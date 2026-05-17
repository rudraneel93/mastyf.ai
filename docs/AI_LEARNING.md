# Enterprise AI learning

MCP Guardian learns from blocked calls and scan history — not per-attack instant ML.

## Controls

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_AI_ENABLED` | on | Master switch for learning on proxy/report |
| `GUARDIAN_AI_AUTO_APPLY` | off | Auto-merge generated YAML rules (use quorum) |
| `GUARDIAN_AI_ON_CLI` | off | Learning on `scan`/`audit`/`health` CLI |
| `GUARDIAN_AI_SNAPSHOT_DIR` | `~/.mcp-guardian` | Persisted baselines / suggestions |
| `GUARDIAN_AI_ATTACK_MIN_BLOCKS` | `3` | Blocks before attack-pattern learning |
| `GUARDIAN_AI_DRIFT_OVERRIDE` | off | Allow threshold changes during drift |

## Safety rails (v2.6+)

- **Quorum** — multiple signals required before high-confidence suggestions (`learning-quorum.ts`).
- **Drift detection** — freezes auto threshold tuning when tool baselines drift (`drift-detector.ts`).
- **Rollback** — `mcp-guardian ai rollback` restores last known-good policy snapshot.
- **Poisoning tests** — `tests/ai/learning-poisoning.test.ts`.

## Async semantic audit (post-hoc LLM)

Non-blocking queue after sync policy passes:

| Variable | Default |
|----------|---------|
| `GUARDIAN_SEMANTIC_ASYNC` | on when LLM enabled |
| `GUARDIAN_SEMANTIC_DEBOUNCE_MS` | `500` |
| `GUARDIAN_SEMANTIC_ASYNC_MAX_QUEUE` | `200` |
| `GUARDIAN_SEMANTIC_MIN_CONFIDENCE` | `0.6` |

Observability: Prometheus `mcp_guardian_semantic_audit_*` metrics; structured log event `async_semantic_flag`.

## LLM response cache (enterprise)

Deduplicates identical LLM prompts across replicas (semantic scan + Ollama assistant):

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_LLM_CACHE` | on when `REDIS_URL` set | `true` / `false` to force enable/disable |
| `GUARDIAN_LLM_CACHE_TTL_SEC` | `3600` | Redis + LRU entry TTL (seconds) |
| `REDIS_URL` | — | Shared cache backend for multi-replica HA |

Cache key: SHA-256 of `model`, `system`, `prompt`, and `temperature`. Metrics: `mcp_guardian_llm_cache_hits_total`, `mcp_guardian_llm_cache_misses_total` (label `backend`: `redis` | `lru`).

Without Redis, cache runs in-process LRU only (single replica).

## Centralized LLM config

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_LLM_PROVIDER` | auto from API keys | `anthropic` \| `openai` \| `ollama` |
| `GUARDIAN_LLM_MODEL` | provider default | Model id for semantic + assistant |
| `GUARDIAN_LLM_MAX_TOKENS` | `512` | `max_tokens` / `num_predict` cap |
| `GUARDIAN_LLM_TIMEOUT_MS` | `30000` | LLM HTTP timeout |
| `GUARDIAN_LLM_TEMPERATURE` | `0.1` | Sampling temperature |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base (`OLLAMA_URL` alias) |

Implementation: `src/config/llm-config.ts`, `src/ai/llm-cache.ts`.

## Operations

```bash
# Inspect learning state
mcp-guardian tui   # AI Engine tab

# Revert AI-applied rules
mcp-guardian ai rollback --policy default-policy.yaml
```

Treat auto-apply as **staging-only** until you review suggestions in the TUI or dashboard API.
