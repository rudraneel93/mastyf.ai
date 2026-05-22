# Security Swarm — Analysis


## Track B — Live official filesystem MCP

**Upstream:** `@modelcontextprotocol/server-filesystem`  
**Sandbox:** `/var/folders/8k/zjxbk9cj4q369h37ybgy6r7c0000gn/T/mcp-guardian-real-life-ZRm1sY`  
**Profile:** hybrid  
**Generated:** 2026-05-22T12:53:54.496Z

| Scenarios passed | 6/6 |

See **analysis.txt** for full per-scenario breakdown.

---

## Track A — Security swarm gates

# Security Swarm Report

Generated: 2026-05-22T12:59:52.329Z  
Commit: `6b445c67cae3e8a4b263593588bcffa0866c9660`  
Mode: **full**  
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
- **adversarial-harness-full**: OK (exit 0)
- **attack-learning-sim**: OK (exit 0)

## Bypasses

_None detected._

## Evidence links

- [enterprise-findings-fixes/summary.md](enterprise-findings-fixes/summary.md)
- [adversarial-harness/reports/harness-summary.md](../../adversarial-harness/reports/harness-summary.md)
