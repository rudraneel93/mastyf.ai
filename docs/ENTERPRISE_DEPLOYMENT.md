# Enterprise deployment checklist

Use this guide for production and multi-replica MCP Guardian deployments.

## Required for multi-replica (`GUARDIAN_ENTERPRISE_MODE=true`)

| Capability | Requires Redis |
|------------|----------------|
| Session flow / cross-call exfil detection | Yes |
| Distributed rate limiting | Yes |
| Shared policy eval cache | Recommended |

Set `REDIS_URL` (see [REDIS_HA.md](./REDIS_HA.md)). With `GUARDIAN_STRICT_MODE=true` or `GUARDIAN_REPLICA_COUNT>1`, startup fails if Redis is missing in enterprise mode.

## Semantic layers (honest tiering)

| Layer | Community | Enterprise |
|-------|-----------|------------|
| Regex + schema (request) | Yes | Yes |
| Sync semantic **request** gate | Opt-in (`GUARDIAN_SEMANTIC_SYNC_REQUEST=true`) | **Default ON** when LLM configured |
| Sync semantic **response** gate | Opt-in | Default ON in production |
| Async semantic audit / tribunal | Opt-in | Opt-in |

Env vars:

- `GUARDIAN_SEMANTIC_SYNC_REQUEST` — override enterprise default for request gate
- `GUARDIAN_SEMANTIC_SYNC_REQUEST_TIMEOUT_MS` — default 2500
- `GUARDIAN_SEMANTIC_SYNC_RESPONSE` — response gate
- `GUARDIAN_SEMANTIC_FAIL_CLOSED_MEDIUM` — fail closed on semantic degradation for medium-risk tools
- `GUARDIAN_SEMANTIC_FAIL_CLOSED_LOW` — fail closed on semantic degradation for low-risk tools

## Signed policy governance (recommended)

- Enable strict signed policy enforcement:
  - `GUARDIAN_REQUIRE_SIGNED_POLICY=true`
  - `GUARDIAN_POLICY_TRUSTED_ISSUERS=guardian-admin,security-automation`
  - `GUARDIAN_POLICY_SIGNING_KEY=<shared-secret-or-kms-export>`
- Dashboard policy updates support signed envelopes and can auto-sign when configured.
- Policy signature sidecar path: `.<policy-file>.sig.json` next to your policy file.
- Evidence bundle signing:
  - `GUARDIAN_EVIDENCE_SIGNING_KEY=<hmac-secret>`
  - optional `GUARDIAN_EVIDENCE_SIGNING_KEY_ID=<kid>`
  - output includes `evidence-pack-YYYY-MM-DD.json.sig`

## Four-eyes policy updates

- Enforce dual-control on dashboard policy mutation:
  - `GUARDIAN_POLICY_FOUR_EYES_REQUIRED=true`
- Required headers on `PUT /api/policy`:
  - `X-Guardian-Policy-Proposer`
  - `X-Guardian-Policy-Approver`
  - optional `X-Guardian-Policy-Approval-Expiry`
- Proposer and approver must differ; expired approvals are rejected.

## Audit attestation checkpoints

- Enable checkpoint anchoring for audit hash-chain:
  - `GUARDIAN_AUDIT_HASH_CHAIN=true`
  - `GUARDIAN_AUDIT_ATTESTATION_ENABLED=true`
  - optional `GUARDIAN_AUDIT_ATTESTATION_PATH=/secure/worm/audit-checkpoints.json`
- Status endpoint: `GET /api/audit/attestation`

## Encryption key rotation posture

- Field encryption supports key-version tagging and rotation toggles:
  - `GUARDIAN_DB_ENCRYPTION_KEY`
  - `GUARDIAN_DB_ENCRYPTION_KEY_VERSION=v2`
  - `GUARDIAN_DB_ENCRYPTION_KEY_V1=<old-key>`
  - `GUARDIAN_DB_ENCRYPTION_ROTATION_ENABLED=true`
- Runtime status endpoint: `GET /api/security/encryption-status`
- Rotation execution:
  - `pnpm enterprise:rotate-encryption` (uses `MCP_GUARDIAN_DB_PATH`, updates encrypted `call_records.block_reason`)
  - dry-run: `pnpm enterprise:rotate-encryption -- --dry-run`

## License posture

When `GUARDIAN_ENTERPRISE_MODE=true`:

- `GUARDIAN_CI_BYPASS_LICENSE` and `GUARDIAN_DEV_UNLOCK_ALL` **must not** be set (startup error).
- Use a valid `GUARDIAN_LICENSE_KEY` from Pro setup ([PRO_SETUP.md](./PRO_SETUP.md)).

## Policy eval cache

Enterprise uses **opt-in** caching: only rules with `cacheable: true` in YAML (or allowlisted static rules) cache `pass` decisions.

Legacy broad caching: `GUARDIAN_POLICY_EVAL_CACHE_LEGACY_HEURISTIC=true` (not recommended).

## Rug-pull (OWASP MCP03)

- Fingerprints all `tools/list` responses (JSON-RPC with `id` or notifications).
- Cluster alerts use shared Redis; local flags expire after `GUARDIAN_RUGPULL_LOCAL_TTL_SEC` (default 3600).
- Clear stale local flags on restart: `GUARDIAN_RUGPULL_CLEAR_ON_START=true`.
- Ops API: `DELETE /api/internal/rug-pull` with body `{ "serverName": "...", "tenantId": "..." }` and header `X-Guardian-Internal-Token` matching `GUARDIAN_INTERNAL_ADMIN_TOKEN`.

## Proxy overload protection

`GUARDIAN_PROXY_MAX_INFLIGHT` (default 50) is enforced **before** policy/LLM work on `tools/call`.

## Validation matrix

1. Single node + enterprise + Redis — full session flow and rate limits.
2. Two replicas without Redis — strict enterprise startup should fail.
3. Rug-pull simulation — change tool description mid-session → block.
4. Inflight flood — 51 concurrent calls → early reject without policy eval spike.

## Split-plane shadow rollout (control + data plane)

Run split-plane in shadow mode before any ingress cutover:

1. Start split-plane profile:
   - `docker compose --profile split-plane up -d --build`
2. Keep data plane in shadow mode:
   - `DATA_PLANE_SHADOW_MODE=true`
   - `DATA_PLANE_FAIL_OPEN=true`
3. Run parity harness repeatedly across live traffic windows:
   - `node scripts/control-plane/run-parity-harness.mjs`
4. Hard-switch ingress only when acceptance criteria hold.

### Hard-switch acceptance criteria

- Parity harness fixtures remain in range (20–50 representative `tools/call` cases).
- `mismatches == 0` in at least 3 consecutive parity runs during live traffic windows.
- `/readyz` on both control and data planes reports healthy.
- Then cut over ingress and set `DATA_PLANE_SHADOW_MODE=false`.
