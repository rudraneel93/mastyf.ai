# Enterprise roadmap (prioritized)

Self-hosted **v2.9.x** is production-viable with [ENTERPRISE_DEPLOY.md](./ENTERPRISE_DEPLOY.md). This roadmap covers the **platform gaps** for a managed enterprise product.

## P0 — Next releases (security + ops)

| Item | Rationale | Status |
|------|-----------|--------|
| **adv-066 closure in harness** | 85/85 evasion; allowlist must not pass unsafe args | Fixed: encoding guard + yaml allowlist re-check |
| **Enterprise evidence pack** | Procurement needs one bundle | `pnpm enterprise:evidence-pack` |
| **Helm `values-enterprise.yaml`** | Opinionated HA/auth/tenant overlay | Shipped |
| **Audit log hash chain** | Tamper-evident JSONL (THREAT_MODEL) | Shipped for policy audit (`GUARDIAN_AUDIT_HASH_CHAIN`); extend to SIEM JSONL next |

## P1 — Platform (v2.10 – v2.11)

| Item | Rationale | Priority |
|------|-----------|----------|
| **Dashboard policy editor** | YAML remains source of truth; guided edit + test in SPA (Policy tab already loads live YAML) | **Next (v2.10.0)** |
| **Inbound HTTP/SSE gateway** | Non-stdio MCP ingress for shared gateways | v2.10.x |
| **Full WebSocket transport parity** | Match stdio feature set (see TRANSPORT.md) | v2.10.x |
| **Enhanced SIEM templates** | Splunk/Datadog field mappings out of the box | v2.11 |
| **Production MSI / code-sign CI** | Windows enterprise desktop rollout | v2.11 |

**Recommended next P1 (May 2026):** **Dashboard policy editor** — completes the live-data dashboard loop (metrics + analysis + editable policy + test sandbox) without new transport work. HTTP/SSE gateway follows for K8s/shared-gateway deployments.

## P2 — v3.0 control plane

| Item | Rationale | Status |
|------|-----------|--------|
| **Multi-tenant control plane** | Central onboarding, policy distribution | MVP: [`docs/SAAS_CONTROL_PLANE.md`](./SAAS_CONTROL_PLANE.md) — `apps/cloud` (free OSS) |
| **Hosted SaaS option** | Managed Guardian cloud | Control plane shipped; managed proxy hosting remains future |
| **gRPC transport** | High-throughput agent ↔ gateway | Planned |
| **Signed plugin marketplace** | Curated third-party detectors | Planned |

## P3 — Global scale

| Item | Rationale |
|------|-----------|
| **Multi-region active-active** | Lock-aware Redis + replication (today: single-region only) |
| **Formal SOC2 / FedRAMP artifact packs** | Customer compliance programs |

## Explicit non-goals (v2.9)

- Guaranteed &lt;50ms p95 at all concurrency tiers (hardware-dependent; see benchmarks)
- ROI / dollar-value marketing charts in technical docs

## How to influence priority

1. File issues with **deployment model** (IDE stdio vs K8s gateway vs SaaS).
2. Attach **enterprise-evidence-pack** output for security reviews.
3. Contribute transport or SIEM integrations via `@mcp-guardian/plugin-sdk`.
