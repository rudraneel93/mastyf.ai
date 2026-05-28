# Breakthrough Autopilot Foundation

This document describes the production foundation added for autonomous remediation:

- Hard safety contract for rollout gating.
- Unified event schema for threat, decision, and rollout telemetry.
- Policy impact scoring for promote/canary/hold decisions.
- Evidence-first approval APIs with rollback support.
- Privacy-safe federated weighting model for threat-intel sharing.
- Segment-ready policy packages that reuse the same core engine.

## Safety Contract

Implemented in `src/ai/autopilot-safety-contract.ts`.

Key safety gates:

- Simulation must pass.
- Replay coverage must meet minimum threshold.
- Confidence must meet minimum threshold.
- Predicted FP and bypass deltas are bounded.
- Blast radius and rollback confidence are bounded.
- Canary size is constrained before broader rollout.

Configurable via env:

- `GUARDIAN_AUTOPILOT_MIN_REPLAY_COVERAGE`
- `GUARDIAN_AUTOPILOT_MIN_CONFIDENCE`
- `GUARDIAN_AUTOPILOT_MAX_FP_DELTA`
- `GUARDIAN_AUTOPILOT_MAX_BYPASS_DELTA`
- `GUARDIAN_AUTOPILOT_MAX_BLAST_RADIUS`
- `GUARDIAN_AUTOPILOT_MIN_ROLLBACK_CONFIDENCE`
- `GUARDIAN_AUTOPILOT_MAX_CANARY_SIZE`

## Unified Event Schema

Implemented in `src/ai/autopilot-event-schema.ts` and extended in `src/utils/learning-events.ts`.

Event kinds:

- `threat`
- `decision`
- `rollout`

This standardizes event payload shape across proxy, swarm, and dashboard workflows.

## Impact Scoring

Implemented in `src/ai/policy-impact-scoring.ts`.

Scoring dimensions:

- Security gain
- False-positive risk
- Blast-radius risk
- Rollback risk
- Confidence score
- Overall recommendation: `promote`, `canary_only`, or `hold`

## Approval UX API (Evidence-first)

Implemented in `src/utils/dashboard-server.ts` with helper logic in `src/ai/autopilot-approval.ts`.

New/updated endpoints:

- `POST /api/policy/suggestions/preview`
  - Returns safety decision + impact score before applying.
- `POST /api/policy/suggestions/accept`
  - Now enforces safety gate (unless `GUARDIAN_AUTOPILOT_ENFORCE_SAFETY=false`).
  - Emits autopilot learning event metadata.
- `POST /api/policy/suggestions/rollback`
  - Removes a previously applied rule by name.
  - Writes rollback ledger and learning event.
- `GET /api/policy/suggestions/rollback/ledger`
  - Returns rollback history from the ledger.
- `GET /api/ai/simulation-pack`
  - Generates tenant-specific simulation seeds from observed traffic fingerprints.

## Federated Threat Intel v2

Implemented in `src/utils/federated-threat-intel-v2.ts`.

Adds:

- Provenance-aware signature records.
- Time decay weighting.
- Local compatibility weighting.
- Final weighted ranking for safer cross-tenant adoption.

Integration:

- `src/utils/federated-signature-exchange.ts` now exposes `buildWeightedFleetHints(...)` backed by v2 weighting logic.

## Phase 4 APIs (Certification + Partner Signals)

Implemented in `src/utils/guardian-certified-mcp.ts` and `src/utils/dashboard-server.ts`:

- `GET /api/certification/guardian-mcp`
  - Returns current Guardian certification status (`none|bronze|silver|gold`) and check evidence.
- `GET /api/partners/signals`
  - Returns partner-consumable signal feed for ecosystem integrations.

Additional phase-completion APIs:

- `GET /api/benchmarks/similar-environment`
  - Returns adaptive per-server benchmarks against similar peer behavior.
- `GET /api/assurance/continuous`
  - Returns continuous assurance report from live controls + runtime metrics.

## Segment Packages

Added starter policy packs in `policy-templates/segments/`:

- `enterprise-soc.yaml`
- `ai-startup.yaml`
- `regulated.yaml`
- `mcp-builder.yaml`

These are packaging overlays: one shared engine, different deployment defaults.
