# MCP Tests 31 — Verification log

**Date:** 2026-05-23  
**Release:** v2.10.0

| Gate | Result |
|------|--------|
| `pnpm build` | Pass |
| New unit tests (swarm, tenant-budget, gateway, DLP decode) | 12/12 pass |
| `@mcp-guardian/core` tests (ajv) | Pass after schema test fix |
| Full `pnpm test` | Run before tag (local) |
| `pnpm security-swarm:fast` | Run before tag (local) |

Evidence pack: `pnpm enterprise:evidence-pack` (regenerate after full test suite).
