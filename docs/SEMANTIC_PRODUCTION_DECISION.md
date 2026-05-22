# Production semantic layer decision (M-2)

**Default for production:** keep **`GUARDIAN_SEMANTIC_ASYNC=false`** unless you accept LLM latency and API cost.

| Mode | When to use |
|------|-------------|
| Regex + request-path PI (default) | 154/154 corpus with `GUARDIAN_DISABLE_SEMANTIC=true`; lowest latency |
| `GUARDIAN_LOCAL_SEMANTIC=true` | Heuristic 0–1 risk when no API key (default on without keys) |
| `GUARDIAN_SEMANTIC_ASYNC=true` | High-risk deployments; tier-2 LLM audit on flagged calls |
| `GUARDIAN_SEMANTIC_SYNC_RESPONSE=true` | Sync gate on tool **responses** (adds latency; use with DLP) |

**Recommendation:** Start with regex + local semantic + response DLP (`GUARDIAN_RESPONSE_DLP_MODE=block`). Enable async LLM semantic only after baseline SLOs are met in staging.

See [AI_LEARNING.md](./AI_LEARNING.md) and [ENTERPRISE_READINESS.md](./ENTERPRISE_READINESS.md).
