/**
 * Short enterprise scenario: growing blocked-attack stream — instant vs batch-only learning.
 * Run: pnpm exec tsx scripts/simulate-attack-learning-stream.ts
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
const SESSION_MS = 52 * 60_000;

const shortConfig: EvalConfig = {
  sessionMs: SESSION_MS,
  interArrivalMinMs: 8_000,
  interArrivalMaxMs: 30_000,
  minBlocks: parseInt(process.env.EVAL_EVENT_COUNT || '240', 10),
};

function writeSummary(
  instant: ReturnType<typeof runInstantScenario>,
  batch: ReturnType<typeof runBatchScenario>,
  eventCount: number,
): string {
  const instantWinsLatency = instant.medianTimeToSuggestionMs < batch.medianTimeToSuggestionMs;
  const instantMoreSuggestions = instant.suggestionsQueued >= batch.suggestionsQueued;
  return `# Attack learning evaluation — enterprise stream scenario

Generated: ${new Date().toISOString()}

## Scenario

- **${eventCount}** simulated blocked \`tools/call\` events over **${Math.round(SESSION_MS / 60_000)}** minutes
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

## Findings

1. **Instant learning ${instantWinsLatency ? 'outperforms' : 'does not outperform'} batch-only on latency** — median time from first block to queued suggestion is ${(instant.medianTimeToSuggestionMs / 1000).toFixed(1)}s vs ${(batch.medianTimeToSuggestionMs / 1000).toFixed(1)}s.
2. **Suggestion throughput** — instant queued **${instant.suggestionsQueued}** attack-pattern suggestions vs **${batch.suggestionsQueued}** under batch-only debounced \`learnAttackPatterns\` flushes.
3. **Repeat clusters** — top repeat rule×tool within ${REPEAT_WINDOW_MS / 60_000}min: \`${instant.repeatClusters[0]?.groupKey ?? 'n/a'}\` (${instant.repeatClusters[0]?.repeatCount ?? 0} repeats).
4. **Per-block sync path** — instant learning updates rolling state on every block; batch-only waits for **${DEBOUNCE_MS / 1000}s** quiet period before evaluating patterns.

## Verdict

**Instant learning ${instantWinsLatency && instantMoreSuggestions ? 'outperforms' : instantWinsLatency || instantMoreSuggestions ? 'partially outperforms' : 'is comparable to'} batch-only** in this enterprise burst scenario. Instant reduces time-to-suggestion by synchronously counting window blocks and queueing after \`${attackMinBlocks()}\` hits; batch-only defers pattern extraction until debounce boundaries, which delays discovery during continuous attack streams.

## Artifacts

- \`metrics.json\` — full time series and per-category latencies
- \`figures/\` — PNG charts (\`pnpm eval:attack-learning:charts\`)
- \`attack-learning-eval.canvas.tsx\` — interactive charts (open from Cursor canvases or reports copy)
`;
}

function main(): void {
  const events = generateEvents(shortConfig);

  console.log(`[eval] Generated ${events.length} blocked events`);
  const instant = runInstantScenario(events);
  const batch = runBatchScenario(events);

  mkdirSync(REPORT_DIR, { recursive: true });

  const heatmap = buildHeatmap(events);
  const latencyBuckets = latencyHistogram(
    instant.firstSuggestionLatencyMs,
    batch.firstSuggestionLatencyMs,
  );

  const metrics = {
    generatedAt: new Date().toISOString(),
    runType: 'short',
    config: {
      eventCount: events.length,
      sessionMinutes: SESSION_MS / 60_000,
      repeatWindowMs: REPEAT_WINDOW_MS,
      minBlocks: attackMinBlocks(),
      debounceMs: DEBOUNCE_MS,
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
      cumulativeInstant: downsample(instant.cumulativeUniqueSuggested),
      cumulativeBatch: downsample(batch.cumulativeUniqueSuggested),
      queueInstant: downsample(instant.queueSizeOverTime),
      queueBatch: downsample(batch.queueSizeOverTime),
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
  writeFileSync(join(REPORT_DIR, 'summary.md'), writeSummary(instant, batch, events.length));

  console.log('[eval] Wrote', join(REPORT_DIR, 'metrics.json'));
  console.log('[eval] Instant:', instant.suggestionsQueued, 'suggestions, median latency', instant.medianTimeToSuggestionMs, 'ms');
  console.log('[eval] Batch:', batch.suggestionsQueued, 'suggestions, median latency', batch.medianTimeToSuggestionMs, 'ms');
}

main();
