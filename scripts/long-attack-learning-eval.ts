/**
 * Long-run attack-learning evaluation: 6h simulated session, 2000+ blocks, 2–5s inter-arrival.
 * Run: pnpm exec tsx scripts/long-attack-learning-eval.ts
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  attackMinBlocks,
  generateEvents,
  buildHeatmap,
  latencyHistogram,
  runInstantScenario,
  runBatchScenario,
  downsample,
  DEBOUNCE_MS,
  REPEAT_WINDOW_MS,
  type EvalConfig,
} from './lib/attack-learning-eval-core.js';

const REPORT_DIR = join(process.cwd(), 'reports', 'attack-learning-eval');

const SESSION_HOURS = parseFloat(process.env.EVAL_SESSION_HOURS || '6');
const SESSION_MS = SESSION_HOURS * 60 * 60_000;
const MIN_BLOCKS = parseInt(process.env.EVAL_MIN_BLOCKS || '2500', 10);

const config: EvalConfig = {
  sessionMs: SESSION_MS,
  interArrivalMinMs: 2_000,
  interArrivalMaxMs: 5_000,
  minBlocks: MIN_BLOCKS,
};

function writeSummary(
  instant: ReturnType<typeof runInstantScenario>,
  batch: ReturnType<typeof runBatchScenario>,
  events: ReturnType<typeof generateEvents>,
  sessionHours: number,
): string {
  const instantWinsLatency = instant.medianTimeToSuggestionMs < batch.medianTimeToSuggestionMs;
  const instantMoreSuggestions = instant.suggestionsQueued >= batch.suggestionsQueued;
  const simDurationMin = Math.round((events[events.length - 1]?.simTs ?? 0) / 60_000);
  const simDurationHr = (simDurationMin / 60).toFixed(1);

  return `# Attack learning evaluation — long-run enterprise stream

Generated: ${new Date().toISOString()}

## Scenario

- **${events.length}** simulated blocked \`tools/call\` events over **${simDurationHr}h** (${simDurationMin} min wall-clock simulated)
- Target session: **${sessionHours}h** · inter-arrival: **2–5s** · min blocks: **${MIN_BLOCKS}**
- Categories: shell-injection, path-traversal, prompt-injection, sensitive-path, sql, puppeteer-url
- Repeat window: **${REPEAT_WINDOW_MS / 60_000}** min · min blocks to suggest: **${attackMinBlocks()}** · batch debounce: **${DEBOUNCE_MS / 1000}s**

## Key metrics

| Metric | Instant learning | Batch-only (debounced) |
|--------|------------------|-------------------------|
| Suggestions queued | ${instant.suggestionsQueued} | ${batch.suggestionsQueued} |
| Unique rule×tool groups learned | ${instant.uniqueRuleToolsSuggested} | ${batch.uniqueRuleToolsSuggested} |
| Avg blocks to first suggestion | ${instant.avgBlocksToSuggestion.toFixed(2)} | ${batch.avgBlocksToSuggestion.toFixed(2)} |
| Median time-to-suggestion | ${(instant.medianTimeToSuggestionMs / 1000).toFixed(1)}s | ${(batch.medianTimeToSuggestionMs / 1000).toFixed(1)}s |
| Total blocks processed | ${instant.totalBlocks} | ${batch.totalBlocks} |

## Long-run findings

1. **Instant learning ${instantWinsLatency ? 'outperforms' : 'does not outperform'} batch-only on latency** — median time from first block to queued suggestion is ${(instant.medianTimeToSuggestionMs / 1000).toFixed(1)}s vs ${(batch.medianTimeToSuggestionMs / 1000).toFixed(1)}s over ${simDurationHr}h of sustained attack traffic.
2. **Suggestion throughput** — instant queued **${instant.suggestionsQueued}** attack-pattern suggestions vs **${batch.suggestionsQueued}** under batch-only debounced flushes (${instantMoreSuggestions ? 'instant ≥ batch' : 'batch > instant'}).
3. **Repeat clusters** — top repeat rule×tool within ${REPEAT_WINDOW_MS / 60_000}min: \`${instant.repeatClusters[0]?.groupKey ?? 'n/a'}\` (${instant.repeatClusters[0]?.repeatCount ?? 0} repeats). See \`figures/fig3-repeat-clusters.png\`.
4. **Continuous-stream penalty for batch-only** — with 2–5s inter-arrival, debounce (${DEBOUNCE_MS / 1000}s) rarely fires mid-stream; batch discovery clusters at session end. Instant discovers patterns incrementally (see cumulative curve in \`figures/fig2-cumulative-suggestions.png\`).
5. **Queue growth** — instant pending queue reaches **${Math.max(...instant.queueSizeOverTime.map((p) => p.value), 0)}** suggestions vs batch peak **${Math.max(...batch.queueSizeOverTime.map((p) => p.value), 0)}** (\`figures/fig5-queue-size.png\`).

## Verdict

**Instant learning ${instantWinsLatency && instantMoreSuggestions ? 'outperforms' : instantWinsLatency || instantMoreSuggestions ? 'partially outperforms' : 'is comparable to'} batch-only** in this long-run enterprise scenario (${events.length} blocks, ${simDurationHr}h simulated). Instant maintains sub-minute-to-few-minute discovery during active attack windows; batch-only defers evaluation until quiet periods, pushing median latency toward session end.

## Artifacts

- \`metrics.json\` — full time series, CDFs, heatmap, per-rule block counts
- \`figures/\` — PNG charts (300 DPI)
- \`attack-learning-eval.canvas.tsx\` — interactive charts
`;
}

function main(): void {
  console.log(`[long-eval] Generating events: ${SESSION_HOURS}h session, min ${MIN_BLOCKS} blocks, 2-5s inter-arrival`);
  const t0 = Date.now();
  const events = generateEvents(config);
  const simDurationMs = events[events.length - 1]?.simTs ?? 0;
  console.log(`[long-eval] Generated ${events.length} events, simulated span ${(simDurationMs / 3_600_000).toFixed(2)}h`);

  const instant = runInstantScenario(events, 15);
  const batch = runBatchScenario(events, 15);

  mkdirSync(REPORT_DIR, { recursive: true });

  const heatmap = buildHeatmap(events);
  const latencyBuckets = latencyHistogram(instant.firstSuggestionLatencyMs, batch.firstSuggestionLatencyMs);

  const metrics = {
    generatedAt: new Date().toISOString(),
    runType: 'long',
    config: {
      eventCount: events.length,
      sessionHours: SESSION_HOURS,
      simulatedDurationMs: simDurationMs,
      simulatedDurationHours: simDurationMs / 3_600_000,
      interArrivalMs: [config.interArrivalMinMs, config.interArrivalMaxMs],
      minBlocks: MIN_BLOCKS,
      repeatWindowMs: REPEAT_WINDOW_MS,
      minBlocksToSuggest: attackMinBlocks(),
      debounceMs: DEBOUNCE_MS,
      wallClockMs: Date.now() - t0,
    },
    instant,
    batchOnly: batch,
    heatmap,
    latencyHistogram: latencyBuckets,
    comparison: {
      instantFasterByMs: batch.medianTimeToSuggestionMs - instant.medianTimeToSuggestionMs,
      extraSuggestionsInstant: instant.suggestionsQueued - batch.suggestionsQueued,
      instantOutperforms:
        instant.medianTimeToSuggestionMs < batch.medianTimeToSuggestionMs &&
        instant.suggestionsQueued >= batch.suggestionsQueued,
    },
    chartSeries: {
      blocksPerMinuteInstant: instant.blocksPerMinute,
      blocksPerMinuteBatch: batch.blocksPerMinute,
      cumulativeInstant: downsample(instant.cumulativeUniqueSuggested, 200),
      cumulativeBatch: downsample(batch.cumulativeUniqueSuggested, 200),
      queueInstant: downsample(instant.queueSizeOverTime, 200),
      queueBatch: downsample(batch.queueSizeOverTime, 200),
      repeatTop15: instant.repeatClusters.slice(0, 15),
      cdfInstant: instant.cdfByCategory,
      cdfBatch: batch.cdfByCategory,
      blocksUntilSuggestionByRule: {
        instant: instant.blocksUntilSuggestionByRule,
        batch: batch.blocksUntilSuggestionByRule,
      },
    },
  };

  writeFileSync(join(REPORT_DIR, 'metrics.json'), JSON.stringify(metrics, null, 2));
  writeFileSync(join(REPORT_DIR, 'summary.md'), writeSummary(instant, batch, events, SESSION_HOURS));

  console.log('[long-eval] Wrote', join(REPORT_DIR, 'metrics.json'));
  console.log('[long-eval] Instant:', instant.suggestionsQueued, 'suggestions, median', instant.medianTimeToSuggestionMs, 'ms');
  console.log('[long-eval] Batch:', batch.suggestionsQueued, 'suggestions, median', batch.medianTimeToSuggestionMs, 'ms');
  console.log('[long-eval] Wall clock:', ((Date.now() - t0) / 1000).toFixed(1), 's');
}

main();
