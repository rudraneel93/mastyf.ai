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

## Operations

```bash
# Inspect learning state
mcp-guardian tui   # AI Engine tab

# Revert AI-applied rules
mcp-guardian ai rollback --policy default-policy.yaml
```

Treat auto-apply as **staging-only** until you review suggestions in the TUI or dashboard API.
