# MCP Guardian — Directory Listing Information

Copy/paste for submitting to MCP tool directories and registries.

---

## Project Name

MCP Guardian

## One-Line Description

Security, cost, and health governance proxy for Model Context Protocol (MCP) infrastructure.

## Category / Tags

`security` `governance` `audit` `policy` `proxy` `observability` `cost-tracking` `mcp` `zero-trust` `llm-security` `infrastructure`

## URLs

- **npm:** https://www.npmjs.com/package/@mcp-guardian/server
- **GitHub:** https://github.com/rudraneel93/mcp-guardian
- **GitHub Releases (version tags):** https://github.com/rudraneel93/mcp-guardian/releases

## Long Description (300–500 chars)

MCP Guardian is a runtime security and governance proxy for Model Context Protocol infrastructure. It sits between AI clients (Cline, Claude) and MCP servers, enforcing YAML-configurable security policies (blocklists, allowlists, rate limits, token budgets), tracking real token costs via `tiktoken`, and monitoring health with live JSON-RPC probes. Features include OAuth 2.1/OIDC authentication with RBAC, web dashboard with Prometheus metrics, seven operational runbooks, disaster recovery planning, mTLS zero-trust networking, and a formal STRIDE threat model. Available as an npm package and MCP server tool.

## Installation

```bash
# CLI (recommended)
npm install -g @mcp-guardian/server

# As an MCP server tool in cline_mcp_settings.json
# { "mcpServers": { "mcp-guardian": { "command": "npx", "args": ["-y", "@mcp-guardian/server"] } } }
```

## Quick Start

```bash
# Start security proxy with active policy enforcement
mcp-guardian proxy --policy ./default-policy.yaml --blocking-mode block

# One-off security scan
mcp-guardian scan --fail-on-critical

# Full audit report
mcp-guardian report --format markdown
```

## Key Features

- **Active Policy Engine** — YAML rules: blocklists, allowlists, regex patterns, rate limits, token budgets in audit/warn/block modes
- **Payload Normalization** — Multi-stage decoding defeats URL/hex/unicode/HTML entity bypass attacks
- **Semantic Shell Analysis** — AST-based detection of command substitution, pipe chains, and dangerous commands (33 detected)
- **OAuth 2.1 / OIDC** — JWT validation with RBAC (scopes, client IDs), DPoP sender-constrained tokens, session replay protection
- **Web Dashboard** — Live Prometheus metrics, per-server circuit breaker status, policy editor with hot-reload
- **Real Cost Tracking** — Proxy interceptor captures actual `tools/call` traffic, counts tokens via `tiktoken`
- **Production Ready** — Helm chart, mTLS, circuit breakers, Redis HA, OpenTelemetry tracing, SIEM logging
- **168 Tests** — Unit, fuzz, integration, and E2E tests across 16 suites

## Directories to Submit To

| Directory | URL | Submission Method |
|-----------|-----|-------------------|
| **MCP Get** | https://mcp-get.com | Submit via their GitHub: https://github.com/michaellatman/mcp-get |
| **Hexmos MCP Tools** | https://mcp-tools.hexmos.com | Submit via their submission form or GitHub |
| **GitHub MCP Servers List** | https://github.com/modelcontextprotocol/servers | Submit PR adding entry to README |
| **Smithery** | https://smithery.ai | Register/connect via their platform |
| **mcprun.com** | https://mcprun.com | Submit via their directory form |
| **PulseMCP** | https://pulsemcp.com | Submit via website listing form |
| **Awesome MCP** | https://github.com/punkpeye/awesome-mcp-servers | Submit PR to the awesome list |

## GitHub MCP Servers README Entry (for PR)

```markdown
### MCP Guardian

Security, cost, and health governance proxy for MCP infrastructure. Enforces YAML policies (blocklists, rate limits, token budgets), tracks real token costs, monitors server health, and provides enterprise-grade observability.

- **Install:** `npm install -g @mcp-guardian/server`
- **Repo:** https://github.com/rudraneel93/mcp-guardian
- **Categories:** Security, Governance, Auditing, Observability
```

## npm Badge

```
[![npm version](https://img.shields.io/npm/v/@mcp-guardian/server)](https://www.npmjs.com/package/@mcp-guardian/server)
```

## Social / Promotion

- **Bluesky/Threads:** Post with #MCP #AISecurity #ModelContextProtocol tags, link to GitHub
- **Reddit:** r/ModelContextProtocol, r/llmsecurity, r/selfhosted
- **Hacker News:** Show HN post with a live demo link
- **Discord:** MCP community Discord (invite via modelcontextprotocol.io)