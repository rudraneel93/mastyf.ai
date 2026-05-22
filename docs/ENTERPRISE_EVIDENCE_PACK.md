# Enterprise evidence pack

Procurement and security teams should rely on **CI-gated** artifacts, not synthetic simulation charts alone.

## Generate the pack

```bash
pnpm build
pnpm eval                                    # optional refresh
./adversarial-harness/run-all.sh             # optional refresh (~minutes)
pnpm enterprise:evidence-pack
```

Output directory: [`reports/enterprise-evidence-pack/`](../reports/enterprise-evidence-pack/)

| File | Meaning |
|------|---------|
| `corpus-eval-report.json` | 228 corpus fixtures — PolicyEngine + `default-policy.yaml` |
| `adversarial-harness-results.json` | Live proxy + evasion matrix |
| `adversarial-harness-summary.md` | Human-readable harness verdict |
| `attack-learning-eval-metrics.json` | Instant vs batch learning (repo eval) |
| `enterprise-findings-fixes-summary.md` | 17/17 enterprise assessment closures |
| `PEN_TEST_REPORT.md` | Pen-test narrative |
| `DISASTER_RECOVERY.md` | DR / backup procedures |
| `THREAT_MODEL.md` | Threat model |
| `ATTACK_MATRIX.md` | OWASP MCP mapping |
| `manifest.json` | Generation metadata + regen commands |

## What not to attach as primary evidence

| Source | Label |
|--------|--------|
| `reports/enterprise-attack-sim/` | **Synthetic** five-scenario sim |
| `sca/CHART_*.png` | **Synthetic** 180-minute escalation narrative |
| Dashboard screenshots only | Operational — supplement with JSON above |

## Recommended CI gates (release)

```bash
pnpm test
pnpm eval
./adversarial-harness/run-all.sh
pnpm test:integration
```

Optional RC: `LOG_LEVEL=error BENCH_PROXY_CONCURRENCY_TIERS=1 pnpm benchmark:proxy-tiers`

## Known tracked gap

- **adv-066** (base64 in `search` `note`) — blocked by `encoding-evasion-guard` + allowlist argument re-check; regression: `tests/policy/allowlist-evasion.test.ts`
