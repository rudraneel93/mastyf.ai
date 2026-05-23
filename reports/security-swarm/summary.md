# Security Swarm Report

Generated: 2026-05-23T13:25:17.879Z  
Commit: `c8c7aa7e6e981f3f290e0f2138d0247d07b4bfc7`  
Mode: **fast**  
Overall: **PASS**

## Gates

| Gate | Status |
|------|--------|
| Corpus (228 entries) | PASS |
| Parity (corpus 100%) | PASS |
| Steps | PASS |
| Bypasses (detected / net-new / max) | 0 / 0 / 0 |
| Bypass baseline | PASS |
| Scout audit | PASS |

## Recommended runtime profile

`hybrid` — see [docs/AI_LEARNING.md](../docs/AI_LEARNING.md#deployment-profiles-security-swarm).

## Steps

- **scout-audit**: OK (exit 0)
- **pnpm-build**: OK (exit 0)
- **vitest-policy-proxy-utils**: OK (exit 0)
- **corpus-eval**: OK (exit 0)
- **setup-python-venv**: OK (exit 0)
- **harness-node-tests**: OK (exit 0)
- **harness-parity**: OK (exit 0)

## Bypasses

_None detected._

## Evidence links

- [enterprise-findings-fixes/summary.md](enterprise-findings-fixes/summary.md)
- [adversarial-harness/reports/harness-summary.md](../../adversarial-harness/reports/harness-summary.md)
