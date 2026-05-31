# MCP Guardian — Agentic AI Roadmap (Industry Standard)

This document describes **planned** capabilities that extend MCP Guardian from per-server, per-call protection to **cross-server, cross-agent, systemic** security — the layer enterprise CISOs need to mandate Guardian across an entire MCP fleet.

**Status key:** Shipped = in `src/agentic/` today · Foundation = partial building blocks exist · Planned = roadmap

---

## Current strength (shipped — do not duplicate)

| Area | Modules | Docs |
|------|---------|------|
| Per-call injection | `prompt-injection/*`, semantic async gate | [AGENTIC_FEATURES.md](AGENTIC_FEATURES.md) |
| Threat prediction | `threat-prediction/*` | §1 |
| Policy generation | `policy-gen/*` | §2 |
| Threat mesh (opt-in) | `threat-mesh/*`, `mesh-relay-client.ts` | §3 |
| Honeypots | `honeypot/*` | §4 |
| Supply chain | `supply-chain/*` | §5 |
| Compliance mapping | `compliance/control-mapper.ts`, evidence runner | §7 |
| Drift & rollback | `drift/*` | §8 |
| Red team & fuzzing | `red-team/*`, `protocol-fuzzer/*` | §9 |
| Trust negotiation | `trust-negotiation/*`, `trust-score/*` | §10 |
| Collusion & chains | `collusion-detector/*`, session chain detector | Foundation for A1 |
| Agent reputation | `agent-reputation/*` | Foundation for A3, B1 |
| Capability graph | `capability-graph/*` | Foundation for A1 |
| Intent binding | `intent-binding/*` | Foundation for C3 |
| Sandbox tiers | `sandbox-tier/*` | Foundation for A2 |
| Certification | `certification/*`, MTX records | Foundation for B1 |
| Incident playbook | `incident-playbook/*`, AI investigator | Dashboard + API |

---

## Tier 1 — Paradigm-shifting

### A1: Cross-MCP Causal Attack Chain Detection · Planned

**Problem:** Sophisticated attacks chain innocent calls across multiple MCP servers. Per-call detection misses the pattern.

**Approach:** Real-time causal graph of tool calls per session; detect multi-step patterns (read-sensitive → pass-as-arg → exfil); IR visualizations; extend [`collusion-detector/collusion-watch.ts`](../src/agentic/collusion-detector/collusion-watch.ts) and [`capability-graph/`](../src/agentic/capability-graph/).

**Unique value:** First MCP security tool with fleet-wide attack-chain visibility.

### A2: MCP Server Digital Twin & Policy Sandbox · Planned (foundation: sandbox-tier)

**Problem:** Policy changes are scary — no safe preview against real server behavior.

**Approach:** Capture server twin (schema, call patterns, latency, response shapes); run proposed policies + red team + legitimate traffic in isolation; go/no-go score (% attacks blocked, % workflows preserved, latency impact).

**Unique value:** “Terraform plan for MCP security policies.”

### A3: AI Agent Behavioral Biometrics · Planned (foundation: reputation + abuse scores)

**Problem:** Stolen agent credentials bypass explicit trust negotiation.

**Approach:** Baseline fingerprints (timing, argument shapes, tool ordering, inter-call delays); real-time anomaly when credentials match agent A but behavior matches agent B; multi-signal model with reputation and trust registry.

**Unique value:** Keystroke dynamics for AI agents.

---

## Tier 2 — Ecosystem-level

### B1: Decentralized MCP Reputation Network · Planned (foundation: certifier + MTX)

**Problem:** Trust scores are local; no shared web-of-trust for MCP servers.

**Approach:** Opt-in anonymized score sharing; 8-dimension reputation; consensus weighted by rater reputation; `query_server_reputation`; network-validated Bronze/Silver/Gold/Platinum tiers.

### B2: MCP Ecosystem Health Observatory · Planned

**Problem:** No industry-wide view of MCP adoption, abandonment, or emerging threats.

**Approach:** Opt-in aggregated telemetry; public dashboard (usage, threat heat map, version curves); proactive CVE alerts for servers you use.

### B3: Federated Learning for Threat Detection · Research track

**Problem:** Injection patterns evolve faster than static rules; mesh shares hashes but not model improvements.

**Approach:** On-device ONNX models; federated training with differential privacy; secure aggregation; graduated A/B rollout via threat mesh.

---

## Tier 3 — Enterprise-defining

### C1: MCP Configuration Provenance & Verifiable Audit Chain · Planned

**Problem:** Auditors need tamper-evident config lifecycle, not just decision logs.

**Approach:** Signed append-only log (Merkle tree); actor, timestamp, diff, approval chain; exportable compliance bundle; SIEM integration.

### C2: Threat Modeling as Code (STRIDE / LINDDUN) · Planned

**Problem:** Threat models go stale when MCP configs change.

**Approach:** Auto DFD from configs; STRIDE + LINDDUN per tool; CI: `guardian threat-model --format markdown > THREATS.md`; regen on config change.

### C3: Zero-Trust Continuous Verification Engine · Planned (foundation: intent-binding, SPIFFE docs)

**Problem:** One-time allow/deny is insufficient for zero-trust mandates.

**Approach:** Every call scored on identity, posture, geo, time, recent behavior, data sensitivity; mid-session step-up auth; dynamic policy; SPIFFE/SPIRE integration.

### C4: Cyber Insurance Risk Quantification · Planned

**Problem:** No standard MCP risk language for underwriters or CFOs.

**Approach:** ALE from CVEs × exploit probability, exposure, blast radius; insurance-ready report; integrates with `predict_threats` and trust scores.

### C5: Semantic Policy Translator · Planned

**Problem:** YAML policies are opaque to compliance and business stakeholders.

**Approach:** `policy_to_natural_language` and `natural_language_to_policy` via existing LLM stack; drafts require human approval before enforce.

---

## Recommended build order (12 months)

| Phase | Months | Deliverables |
|-------|--------|--------------|
| **1 — Quick wins** | 1–3 | C5, C1, C2, A3 foundations |
| **2 — Differentiators** | 4–6 | A1, A2, C3 |
| **3 — Ecosystem** | 7–9 | B1, B2, C4 |
| **4 — Research** | 10–12 | B3 federated learning |

---

## Why this becomes industry standard

- **Network effects:** B1 + B2 — more deployments → better data → more value
- **Regulatory alignment:** C1 + C2 + C3 — EO 14028, FedRAMP Rev 5, EU AI Act, PCI-DSS 4.0
- **No direct competition** on cross-MCP chains, digital twins, or agent biometrics today
- **Expanded buyers:** C4 (CFO/insurance), C5 (compliance), C2 (security architects)
- **Compounding moat:** B3 federated learning improves with every opt-in deployment

See also: [AGENTIC_FEATURES.md](AGENTIC_FEATURES.md) (shipped) · [AGENTIC_ARCHITECTURE.md](AGENTIC_ARCHITECTURE.md)
