# Security Policy

## Threat Model (STRIDE per MCP Interaction)

MCP Guardian's security posture is modeled against the STRIDE framework for each MCP interaction vector.

### 1. Spoofing (Identity Forgery)

| Threat | Mitigation |
|---|---|
| Typo-squatted MCP server packages (e.g., `@modelcontextprotcol/sdk` vs `@modelcontextprotocol/sdk`) | Typo-squat detector with Levenshtein distance against 24 known official packages |
| Fake MCP server responding to health probes | TLS certificate validation (expiry, issuer, chain) for SSE/HTTP transports |
| Malicious server impersonating a trusted tool | Command validation flags non-standard executables and unrecognized binaries |

### 2. Tampering (Data/Command Injection)

| Threat | Mitigation |
|---|---|
| Shell injection via tool arguments (e.g., `; rm -rf /`, `&&`, `\|`) | **v0.4:** Active policy engine blocks patterns (`rm -rf`, shell chaining, backtick substitution) |
| Path traversal (`../../etc/passwd`) | **v0.4:** Active policy engine blocks `../` patterns |
| Output redirection (`> /etc/cron.d/...`) | Command validator flags redirection patterns; policy engine can block |
| Supply chain compromise of MCP server package | CVE checker queries OSV.dev and NVD for known vulnerabilities in server package versions |

### 3. Repudiation (Deniability)

| Threat | Mitigation |
|---|---|
| No audit trail for blocked/allowed tool calls | **v0.4:** Structured JSON logging (pino) captures every `policy_decision` with request-ID, server, tool, and decision |
| Denied access attempts not recorded | `tool_blocked` events logged at WARN level for SIEM alerting |
| Cost manipulation / untracked token usage | All `tools/call` traffic logged to SQLite `call_records` table with token counts |

### 4. Information Disclosure (Secrets/Data Leakage)

| Threat | Mitigation |
|---|---|
| Hardcoded API keys, tokens, passwords in MCP config | Secret scanner (6 regex patterns: API keys, GitHub tokens, OpenAI keys, private keys, passwords) |
| Unencrypted transport (HTTP instead of HTTPS) | Auth prober flags unencrypted transports |
| Environment variable leakage via tool args | Policy engine can block patterns referencing `.env` files or sensitive paths |
| Sensitive data in generated reports | Reports use config names, not raw secrets; secrets detection marks locations without exposing values |

### 5. Denial of Service (Availability)

| Threat | Mitigation |
|---|---|
| Token bombs (extremely large requests exhausting context window) | **v0.4:** Token budget rule (`maxTokens`) flags/blocks oversized calls |
| Tool overload (>15 tools causing agent confusion) | Health monitor detects overload; `--fail-on-overload` CLI flag |
| Rate abuse (flood of rapid tool calls) | **v0.4:** Rate limiting rule (`maxCallsPerMinute`) per server+tool |
| API ban on CVE lookup services | Token-bucket rate limiter on OSV.dev (5 req/min) and NVD (20 req/min with key) |

### 6. Elevation of Privilege (Agent Hijacking)

| Threat | Mitigation |
|---|---|
| Confused deputy attack — benign tool coerced into executing malicious commands | **v0.4:** Tool allowlist/denylist in policy engine; argument pattern blocking |
| Agent tricked into calling dangerous tools (`execute_command`, `eval`, `bash`) | Default policy denies `execute_command`, `bash`, `sh`, `eval`, `exec` |
| Tool argument manipulation to escalate privileges | Command validator detects `sudo`, `/etc/sudoers` references; policy engine can block |
| Missing authentication on MCP servers | Auth prober detects missing `API_KEY`, `AUTH_TOKEN`; recommends remediation |

## Supported Versions

| Version | Status | Security Updates |
|---|---|---|
| 0.4.x | ✅ Current | All updates |
| 0.3.x | ✅ Supported | Critical only |
| 0.1.x - 0.2.x | ❌ Unsupported | None |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Email **rudraneel93@gmail.com** with:
- Description of the vulnerability
- Steps to reproduce
- Affected version(s)
- Any proof-of-concept or crash data

Response timeline:
- **24 hours:** Acknowledgement
- **72 hours:** Initial assessment
- **7 days:** Patch or mitigation plan

## Security Design Principles

1. **Least Privilege:** The policy engine denies by default when configured with allowlists
2. **Defense in Depth:** Static scanning (config audit) + runtime enforcement (proxy policy) + logging (SIEM)
3. **Fail Secure:** Graceful shutdown flushes DB before exit; blocked calls return explicit errors
4. **Auditability:** Every policy decision, block, and proxy event is logged as structured JSON
5. **Zero Trust on Input:** All tool arguments are pattern-checked regardless of source

## Dependencies

MCP Guardian requires these critical dependencies:

| Dependency | Purpose | Security Notes |
|---|---|---|
| `@modelcontextprotocol/sdk` | MCP protocol implementation | Keep updated to latest |
| `tiktoken` | Token counting (o200k_base encoding) | Pure JS, no native bindings |
| `sql.js` | SQLite storage | WASM-based, no native compilation |
| `pino` | Structured logging | v0.4+; high-performance JSON logger |
| `js-yaml` | YAML policy parsing | v0.4+; safeLoad used for policy files |
| `axios` | HTTP client for CVE APIs | Rate-limited; no credentials in URLs |
| `zod` | Schema validation | Input validation for policy configurations |

Run `npm audit` regularly and update dependencies through Dependabot or similar tools.