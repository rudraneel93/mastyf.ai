# Security Swarm

Closed-loop agentic workflow for MCP Guardian: scan vulnerabilities, evolve policy and LLM layers from real outcomes, and gate releases on corpus + harness evidence.

## Architecture

![Security Swarm Architecture](../docs/assets/security-swarm-architecture.png)

## Agents

| Agent | Mode | Role |
|-------|------|------|
| **Scout** | CI | `pnpm audit` supply-chain signal |
| **Corpus** | CI | 228-entry eval (`GUARDIAN_DISABLE_SEMANTIC=true pnpm eval`) |
| **Evasion** | Full | Custom probes + `evasion-generate.mjs` on bypasses |
| **Parity** | CI | Node ↔ Python by fixture id |
| **Proxy** | Full | Live stdio MCP via adversarial-harness |
| **Learning-sim** | Full | `pnpm eval:attack-learning` |
| **Report** | CI | `reports/security-swarm/latest.json` |

## Runtime swarm (production)

Implemented in-process (not separate processes):

- **BlockGuard** — sync policy on every `tools/call`
- **InstantLearner** — `recordInstantBlockEvent`
- **SemanticAuditor** — `enqueueSemanticAudit` when `GUARDIAN_SEMANTIC_ASYNC=true`
- **PatternSynthesizer** — debounced `SuggestionEngine`
- **Calibrator** — `POST /api/learning/label` + `scripts/security-swarm/calibrate-semantic.ts`

## Quick start

```bash
# Full swarm (nightly)
node security-swarm/run.mjs

# PR fast path (~5–15 min)
node security-swarm/run.mjs --fast

# Semantic calibration (7d labels)
pnpm exec tsx scripts/security-swarm/calibrate-semantic.ts
```

## Gates

See [`config/gates.json`](config/gates.json):

- Corpus: 100% attack block, 0 benign FP
- Parity: 100% corpus agreement
- Evasion: 0 net new bypasses vs manifest

## Deployment profiles

Documented in [docs/AI_LEARNING.md](../docs/AI_LEARNING.md#deployment-profiles-security-swarm):

- `sync-only` — regex/semantic guards, no LLM latency
- `hybrid` — default enterprise (async semantic optional)
- `high-paranoia` — semantic async + instant LLM + strict quorum

## Reports

- [`reports/security-swarm/latest.json`](../reports/security-swarm/latest.json)
- [`reports/security-swarm/summary.md`](../reports/security-swarm/summary.md)
- [`reports/enterprise-findings-fixes/summary.md`](../reports/enterprise-findings-fixes/summary.md)
