# MCP Guardian — Threat Model

## Overview

This document formalizes the threat model for MCP Guardian, a security proxy for Model Context Protocol (MCP) infrastructure. It follows the STRIDE methodology and defines trust boundaries, attack surfaces, and adversarial assumptions.

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                   TRUSTED ZONE                           │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ AI Client │───▶│ MCP Guardian │───▶│  MCP Server  │  │
│  │ (Cline/   │    │   (Proxy)    │    │  (stdio/SSE) │  │
│  │  Claude)  │◀───│              │◀───│              │  │
│  └──────────┘    └──────────────┘    └──────────────┘  │
│                        │                                │
│                        ▼                                │
│               ┌────────────────┐                        │
│               │ Policy Engine  │                        │
│               │  Auth Gateway  │                        │
│               │  Audit Logger  │                        │
│               └────────────────┘                        │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Infrastructure Services              │  │
│  │  Redis (sessions)   PostgreSQL (audit)            │  │
│  │  Prometheus         OTLP Collector                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

                    ═══════════════════
                    TRUST BOUNDARY
                    ═══════════════════

┌─────────────────────────────────────────────────────────┐
│                  UNTRUSTED ZONE                          │
│                                                          │
│  • External MCP servers (SSE/HTTP)                       │
│  • OIDC identity providers                               │
│  • CVE data sources (OSV.dev, NVD)                       │
│  • Package registries (npm, PyPI)                        │
│  • User-supplied MCP configurations                      │
│  • AI model outputs (prompt injection vectors)            │
└─────────────────────────────────────────────────────────┘
```

## Attack Surface

### Primary Attack Surfaces

| Surface | Description | Risk |
|---------|-------------|------|
| **tools/call interface** | JSON-RPC tool invocations from AI clients | HIGH — primary exploit vector |
| **MCP config files** | User-supplied server configurations | HIGH — supply chain injection |
| **Policy YAML** | Administrator-defined security rules | MEDIUM — misconfiguration risk |
| **OAuth 2.1/OIDC tokens** | JWT bearer tokens | HIGH — token theft/replay |
| **Dashboard API** | HTTP endpoints (/api/policy, /metrics) | MEDIUM — information disclosure |
| **CVE API calls** | External HTTP requests to OSV.dev/NVD | LOW — SSRF potential |

### Secondary Attack Surfaces

| Surface | Risk |
|---------|------|
| Redis connection (session/rate limit store) | MEDIUM — data exfiltration |
| PostgreSQL connection (audit DB) | MEDIUM — audit tampering |
| OTLP exporter (tracing) | LOW — data leakage |
| File watcher (chokidar, policy hot-reload) | LOW — TOCTOU races |

## STRIDE Analysis

### 1. Spoofing (Identity Forgery)

**Threats:**
- Attacker impersonates legitimate AI client using stolen JWT
- Typo-squatted MCP server package name (e.g., `@modelcontextprotcol/sdk`)
- Fake OIDC provider returns valid tokens
- Dashboard API accessed without authentication

**Mitigations:**
- ✅ OAuth 2.1/OIDC JWT validation with issuer verification
- ✅ Session binding — 5-minute session tokens prevent JWT replay
- ✅ DPoP (RFC 9449) sender-constrained token support
- ✅ Typo-squat detector (Levenshtein distance against 24 known packages)
- ⚠️ Dashboard API has no authentication (future: add API key)

### 2. Tampering (Data/Command Injection)

**Threats:**
- Shell injection via tool arguments (`; rm -rf /`, `&&`, `|`)
- Path traversal (`../../etc/passwd`)
- SQL injection via PostgreSQL connection
- Policy YAML tampering (TOCTOU on file read)
- Audit log tampering

**Mitigations:**
- ✅ Active policy engine blocks 10 suspicious patterns
- ✅ PostgreSQL parameterized queries (no string concatenation)
- ✅ PolicyAuditor records every policy change with hash verification
- ✅ PolicyWatcher debounces file reads (300ms) to avoid partial writes
- ⚠️ Audit logs are append-only JSONL (future: signing/hashing)

### 3. Repudiation (Deniability)

**Threats:**
- No audit trail for blocked/allowed tool calls
- Policy changes without accountability
- Session creation/destruction without logging
- Cost audit data deletion without record

**Mitigations:**
- ✅ Structured JSON logging (pino) captures every `policy_decision`
- ✅ `tool_blocked` events logged at WARN level
- ✅ `request_forwarded` and `request_denied` events with requestId
- ✅ PolicyAuditor records changes with timestamp, actor, hash
- ⚠️ No cryptographic chain for audit log integrity (future: hash chain)

### 4. Information Disclosure (Secrets/Data Leakage)

**Threats:**
- Hardcoded API keys in MCP config `env` fields
- Sensitive tool arguments logged in audit trail
- Dashboard /metrics endpoint exposes internal state
- Error messages leak server internals

**Mitigations:**
- ✅ Secret scanner (6 regex patterns) detects hardcoded credentials
- ✅ Reports reference server names, not raw secret values
- ✅ `/metrics` only exposes aggregate counters — no raw data
- ✅ JSON-RPC error responses return standard codes, not stack traces

### 5. Denial of Service (Availability)

**Threats:**
- Token bombs (extremely large requests)
- Rate abuse (flood of rapid tool calls)
- Tool overload (>15 tools causing agent confusion)
- API ban on OSV.dev/NVD from excessive CVE queries
- Circuit breaker exhaustion

**Mitigations:**
- ✅ Token budget rule (`maxTokens`) flags/blocks oversized calls
- ✅ Rate limiting (`maxCallsPerMinute`) per server+tool
- ✅ Per-client rate limiting with Redis for HA
- ✅ Token-bucket rate limiter on external API calls
- ✅ 3-state circuit breaker protects upstream servers

### 6. Elevation of Privilege (Agent Hijacking)

**Threats:**
- Confused deputy attack — benign tool coerced into malicious actions
- Agent tricked into calling dangerous tools (`execute_command`, `eval`)
- Tool argument manipulation to escalate privileges
- Missing authentication exploited to bypass RBAC
- Session token reuse across different agents

**Mitigations:**
- ✅ Tool allowlist/denylist in policy engine
- ✅ Default policy denies `execute_command`, `bash`, `sh`, `eval`, `exec`
- ✅ RBAC with scope and client-ID constraints
- ✅ OAuth 2.1 `required` mode blocks unauthenticated calls
- ✅ Session tokens are per-agent (bound to `sub` claim)

## Adversarial Assumptions

1. **Network model:** Attacker can observe, intercept, and replay unencrypted traffic on the same network segment as the proxy
2. **Client model:** AI clients may be compromised via prompt injection or tool misuse
3. **Server model:** External MCP servers are untrusted and may return malicious responses
4. **Admin model:** Policy administrators are trusted but may make configuration errors
5. **Infrastructure model:** Redis/PostgreSQL are on trusted internal networks; compromise is out of scope

## Risk Acceptance

| Risk | Accepted? | Rationale |
|------|-----------|-----------|
| Dashboard API lacks authentication | ✅ Accepted (v1.0) | Internal-only deployment; future API key |
| SQLite for local deployments | ✅ Accepted (v1.0) | PostgreSQL available for production |
| No audit log cryptographic chain | ⚠️ Partial | JSONL format; hash chain planned for v1.1 |
| No WAF-level payload inspection | ✅ Accepted (v1.0) | Policy engine + regex sufficient for current use |
| No formal verification of policy engine | ✅ Accepted (v1.0) | 11 unit tests; growing fuzz test suite |

## Future Improvements (v1.1+)

- [ ] Fuzz testing suite for policy engine and JSON-RPC parser
- [ ] Cryptographic hash chain for audit log integrity
- [ ] Dashboard API authentication (API key / OAuth)
- [ ] Behavioral anomaly detection for tool usage patterns
- [ ] Malicious MCP server simulation test suite
- [ ] WASM sandbox for policy evaluation isolation
- [ ] Signed policy files with verification chain