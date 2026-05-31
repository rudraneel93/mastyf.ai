# MCP Threat Exchange (MTX) v1

MTX is an open JSON format for sharing **anonymized** MCP attack signatures across Guardian deployments. Records never contain raw tool arguments, PII, or tenant identifiers.

## Record schema

| Field | Type | Description |
|-------|------|-------------|
| `mtxVersion` | `"1.0"` | Format version |
| `signatureHash` | string | SHA-256 of `toolPattern:argPatternHash:category` |
| `toolPattern` | string | Tool name or normalized pattern |
| `argPatternHash` | string | SHA-256 of argument fingerprint (not raw args) |
| `category` | string | Attack class (e.g. `injection`, `exfiltration`) |
| `blockReason` | string | Truncated policy/rule reason (max 200 chars) |
| `reportCount` | number | Observations merged into this signature |
| `firstSeen` / `lastSeen` | ISO-8601 | Observation window |
| `corpusId` | string? | Optional corpus reference |
| `deploymentSalt` | string? | Optional deployment-specific salt |

## Hub API (cloud)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/mtx/contribute` | Upsert a validated MTX record |
| `GET` | `/api/v1/mtx/catalog` | List recent signatures (`?limit=`) |

Contributions upsert on `signatureHash`, incrementing `reportCount` and refreshing `lastSeen`.

## Local sync

Guardian instances persist MTX signatures in SQLite (`mtx_signatures`, migration 012) and may forward anonymized records to the cloud hub when configured.

## Privacy

- Only hashed argument shapes and tool patterns are exchanged.
- Operators should set `deploymentSalt` when they need per-deployment isolation without sharing reversible context.

## Reference implementation

- Package: `packages/mtx` (`@mcp-guardian/mtx`)
- Cloud persistence: `apps/cloud/db/migrations/010_industry_standard.sql` → `public_mtx_catalog`
