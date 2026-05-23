#!/usr/bin/env npx tsx
/**
 * Run shadow red team probes via PolicyEngine + Threat Lab bridge.
 */
import { runShadowRedTeam } from '../../src/ai/shadow-red-team.js';

const run = await runShadowRedTeam({ writeReport: true, queueThreatLab: true });
console.log(
  `[shadow-red-team] ${run.probes.length} probes via ${run.policyPath}, ${run.bypassCount} bypasses (${run.newBypasses} new), threatLab=${run.threatLabProcessed ?? 0}`,
);

process.exit(run.bypassCount > 0 && !run.policyPath ? 1 : 0);
