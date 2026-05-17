# OWASP MCP / LLM Threat → Test Mapping

Maps common MCP and LLM agent threats to automated tests in MCP Guardian.

| OWASP / threat | Description | Corpus category | Unit tests | E2E |
|----------------|-------------|-----------------|------------|-----|
| LLM01 Prompt injection | Ignore instructions, jailbreak, DAN | `attacks/prompt-injection/` (32) | `adversarial-scenarios.test.ts` V-07, V-08 | `adversarial-proxy.e2e` pi-001 |
| LLM02 Insecure output | Malicious tool responses | — | `adversarial-scenarios` V-03 | — |
| LLM06 Sensitive disclosure | Read `/etc/passwd`, `.ssh`, `.env` | `attacks/credential-exfil/` (23) | V-02 | cred-001 |
| LLM08 Excessive agency | `execute_command`, `bash`, GitHub writes | `edge-cases/` | deny-dangerous-tools | edge-020/021 |
| MCP-T1 Tool poisoning | Cross-tool chaining in args | `attacks/cross-tool-chain/` (16) | — | chain-001 |
| MCP-T2 Over-permissioned tools | Default deny + allowlist | `benign/` (55) | allowlist | safe pass |
| Injection (SQL/NoSQL) | UNION, `$where`, `__schema` | `attacks/sql-nosql/` (26) | V-04, V-05 | sql-001 |
| SSRF | Metadata IP, localhost, `file://` | `attacks/ssrf-url/` (26) | V-01, V-09 | ssrf-001, ssrf-007 |
| Command injection | `curl`, `rm -rf`, PowerShell | `attacks/shell-obfuscation/` (26) | V-06, shell rules | shell-001/002 |
| Path traversal | `../` in arguments | `edge-cases/` | block-path-traversal | proxy-with-policy |
| Unicode / obfuscation | Homoglyphs, zero-width, large payloads | `edge-cases/` (22) | confusables, normalizer | — |

## Corpus totals (v2.7.5)

| Category | Count | Expected |
|----------|-------|----------|
| benign | 55 | pass |
| prompt-injection | 32 | block |
| credential-exfil | 23 | block |
| sql-nosql | 26 | block |
| ssrf-url | 26 | block (2 benign URLs pass) |
| shell-obfuscation | 26 | block |
| cross-tool-chain | 16 | block |
| edge-cases | 22 | mixed |
| **Total** | **226** | |

Run: `pnpm eval` → `corpus-eval-report.json`
