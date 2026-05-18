# Attack learning evaluation — long-run enterprise stream

Generated: 2026-05-18T16:48:20.425Z

## Scenario

- **5003** simulated blocked `tools/call` events over **4.9h** (292 min wall-clock simulated)
- Target session: **6h** · inter-arrival: **2–5s** · min blocks: **2500**
- Categories: shell-injection, path-traversal, prompt-injection, sensitive-path, sql, puppeteer-url
- Repeat window: **5** min · min blocks to suggest: **3** · batch debounce: **30s**

## Key metrics

| Metric | Instant learning | Batch-only (debounced) |
|--------|------------------|-------------------------|
| Suggestions queued | 5 | 5 |
| Unique rule×tool groups learned | 5 | 5 |
| Avg blocks to first suggestion | 3.00 | 1000.60 |
| Median time-to-suggestion | 41.1s | 17515.7s |
| Total blocks processed | 5003 | 5003 |

## Long-run findings

1. **Instant learning outperforms batch-only on latency** — median time from first block to queued suggestion is 41.1s vs 17515.7s over 4.9h of sustained attack traffic.
2. **Suggestion throughput** — instant queued **5** attack-pattern suggestions vs **5** under batch-only debounced flushes (instant ≥ batch).
3. **Repeat clusters** — top repeat rule×tool within 5min: `semantic-shell-guard:search` (32 repeats). See `figures/fig3-repeat-clusters.png`.
4. **Continuous-stream penalty for batch-only** — with 2–5s inter-arrival, debounce (30s) rarely fires mid-stream; batch discovery clusters at session end. Instant discovers patterns incrementally (see cumulative curve in `figures/fig2-cumulative-suggestions.png`).
5. **Queue growth** — instant pending queue reaches **5** suggestions vs batch peak **5** (`figures/fig5-queue-size.png`).

## Verdict

**Instant learning outperforms batch-only** in this long-run enterprise scenario (5003 blocks, 4.9h simulated). Instant maintains sub-minute-to-few-minute discovery during active attack windows; batch-only defers evaluation until quiet periods, pushing median latency toward session end.

## Artifacts

- `metrics.json` — full time series, CDFs, heatmap, per-rule block counts
- `figures/` — PNG charts (300 DPI)
- `attack-learning-eval.canvas.tsx` — interactive charts
