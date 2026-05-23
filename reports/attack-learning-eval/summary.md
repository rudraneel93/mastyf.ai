# Attack learning evaluation — enterprise stream scenario

Generated: 2026-05-22T18:52:36.095Z

## Scenario

- **240** simulated blocked `tools/call` events over **52** minutes
- Categories: shell-injection, path-traversal, prompt-injection, sensitive-path, sql, puppeteer-url
- Repeat window: **5** min · min blocks to suggest: **3** · batch debounce: **30s**

## Key metrics

| Metric | Instant learning | Batch-only (debounced) |
|--------|------------------|-------------------------|
| Suggestions queued | 5 | 5 |
| Unique rule×tool groups learned | 5 | 5 |
| Avg blocks to first suggestion | 3.00 | 48.00 |
| Median time-to-suggestion | 252.5s | 2988.7s |
| Total blocks processed | 240 | 240 |

## Findings

1. **Instant learning outperforms batch-only on latency** — median time from first block to queued suggestion is 252.5s vs 2988.7s.
2. **Suggestion throughput** — instant queued **5** attack-pattern suggestions vs **5** under batch-only debounced `learnAttackPatterns` flushes.
3. **Repeat clusters** — top repeat rule×tool within 5min: `semantic-shell-guard:search` (27 repeats).
4. **Per-block sync path** — instant learning updates rolling state on every block; batch-only waits for **30s** quiet period before evaluating patterns.

## Verdict

**Instant learning outperforms batch-only** in this enterprise burst scenario. Instant reduces time-to-suggestion by synchronously counting window blocks and queueing after `3` hits; batch-only defers pattern extraction until debounce boundaries, which delays discovery during continuous attack streams.

## Artifacts

- `metrics.json` — full time series and per-category latencies
- `figures/` — PNG charts (`pnpm eval:attack-learning:charts`)
- `attack-learning-eval.canvas.tsx` — interactive charts (open from Cursor canvases or reports copy)
