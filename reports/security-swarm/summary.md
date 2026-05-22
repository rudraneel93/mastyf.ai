# Security Swarm — Analysis


## Track B — Live official filesystem MCP

**Upstream:** `@modelcontextprotocol/server-filesystem`  
**Sandbox:** `/var/folders/8k/zjxbk9cj4q369h37ybgy6r7c0000gn/T/mcp-guardian-real-life-1i05ag`  
**Profile:** hybrid  
**Generated:** 2026-05-22T12:03:26.344Z

| Scenarios passed | 6/6 |

See **analysis.txt** for full per-scenario breakdown.

---

## Track A — Security swarm gates

# Security Swarm Report

Generated: 2026-05-22T12:05:21.167Z  
Commit: `1c9a55bb4f26a29ea772bd459180110c03f76c60`  
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
