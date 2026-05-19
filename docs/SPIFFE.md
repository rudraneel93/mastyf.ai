# SPIFFE / SVID integration

MCP Guardian can use SPIFFE workload identities for upstream mTLS when running in a mesh or Kubernetes with the SPIRE agent.

## Environment

| Variable | Purpose |
|----------|---------|
| `GUARDIAN_SPIFFE_SOCKET_PATH` | Unix socket for SPIFFE Workload API (e.g. `/run/spire/sockets/agent.sock`) |
| `MCP_TLS_ENABLED` | Set `true` to enable mTLS upstream agents |
| `GUARDIAN_UPSTREAM_CERT_PIN_SHA256` | Optional comma-separated SPKI SHA-256 pins for upstream leaf certs |

## Flow

1. SPIRE agent exposes the Workload API on `GUARDIAN_SPIFFE_SOCKET_PATH`.
2. On first `createMtlsAgent()` / upstream HTTPS fetch, Guardian calls `fetchSpiffeSvidFromWorkloadApi()` (see `src/utils/mtls-config.ts`).
3. Returned X.509 SVID + bundle populate `MCP_TLS_CERT`, `MCP_TLS_KEY`, and `MCP_TLS_CA` for the process lifetime.
4. Combined with `GUARDIAN_UPSTREAM_CERT_PIN_SHA256`, pins prevent MITM even if trust store is misconfigured.

## Deployment notes

- Mount the agent socket into the Guardian pod (`hostPath` or CSI).
- Rotate SVIDs: restart pods or call `resetSpiffeSvidCache()` after agent rotation (hot reload tracked in `docs/MTLS.md`).
- For multi-tenant gateways, SPIFFE ID should map 1:1 to upstream MCP fleet — not per end-user tenant.

## Related

- [docs/TRANSPORT.md](./TRANSPORT.md) — HTTP/SSE/stdio/WebSocket/streamable HTTP
- [docs/MULTI_TENANCY.md](./MULTI_TENANCY.md) — JWT tenant binding vs mesh identity
