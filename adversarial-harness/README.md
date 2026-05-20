# Adversarial Test Harness

Comprehensive security evaluation harness for MCP Guardian policy engine, proxy pipeline, and scanners.

## Components

| Layer | Path | Purpose |
|-------|------|---------|
| **Python policy engine** | `python/policy_engine/` | Faithful port of TS sync pipeline: prompt injection → semantic guards → YAML rules |
| **Corpus** | `../../corpus/` | 151 attack + 55 benign fixtures |
| **Custom attacks** | `fixtures/custom-attacks/` | 85+ adversarial probes (unicode, SSRF, SQL, chains, etc.) |
| **Node integration** | `node/` | Mock MCP stdio server, proxy pipeline, AsyncSerialQueue, streaming races, secret scanner |
| **Orchestrator** | `run-harness.mjs` | Full run + `reports/harness-summary.md` |

## Quick start

```bash
# Full harness (export rules, generate fixtures, Python + Node tests, parity)
node adversarial-harness/run-harness.mjs

# Python only
pnpm exec tsx adversarial-harness/scripts/export-harness-rules.ts
node adversarial-harness/scripts/generate-custom-attacks.mjs
PYTHONPATH=adversarial-harness/python python3 adversarial-harness/python/run_eval.py

# Node harness tests only
pnpm exec vitest run adversarial-harness/node/*.test.mjs
```

## Python parity notes

- Loads `exported/injection_rules.json` from TS `INJECTION_RULES` (same regex sources).
- Mirrors evaluation order: `request-prompt-injection` → `semantic-guards` → `yaml-rules`.
- Does **not** run DistilBERT ML or async session data-flow (use Node `evaluateAsync` for P2 features).
- `scripts/compare-node-python.ts` reports Node vs Python block decisions on all fixtures.

## Reports

- `reports/python-eval.json` — Python corpus + custom results
- `reports/parity-report.json` — Node/Python agreement
- `reports/harness-summary.md` — Orchestrator summary
- `../../corpus-eval-report.json` — Canonical Node corpus eval
