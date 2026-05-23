# Shared MCP gateway (HTTP/SSE + WebSocket)

Deploy MCP Guardian as a **shared ingress** for many tenants — no stdio child processes on the pod.

## Enable

```bash
export GUARDIAN_MULTI_TENANT_ENABLED=true
export GUARDIAN_GATEWAY_MODE=true
mcp-guardian proxy --config /etc/mcp-guardian/mcp.json --policy policy.yaml --gateway
```

Or CLI flag only: `mcp-guardian proxy --gateway` (sets `GUARDIAN_GATEWAY_MODE=true`).

## MCP config

Use `url` + `transport` per upstream MCP server:

```json
{
  "mcpServers": {
    "team-files": {
      "transport": "sse",
      "url": "https://upstream.example.com/sse"
    },
    "team-ws": {
      "transport": "websocket",
      "url": "wss://upstream.example.com/mcp"
    }
  }
}
```

Clients connect to Guardian:

| Transport | Local endpoints |
|-----------|-----------------|
| SSE | `GET /sse`, `POST /message?sessionId=…` |
| WebSocket | `ws://<listen-host>:<GUARDIAN_WS_PROXY_PORT>/` |

## Tenant routing

- `GUARDIAN_MULTI_TENANT_ENABLED=true` (required in gateway mode)
- Authenticated: JWT `tenant_id` must match `X-Guardian-Tenant` / `X-Tenant-Id`
- Unauthenticated pilots: header `X-Guardian-Tenant: acme-corp`

## Kubernetes (Helm)

```bash
helm upgrade --install mcp-guardian ./deploy/helm/mcp-guardian \
  -f deploy/helm/mcp-guardian/values.yaml \
  -f deploy/helm/mcp-guardian/values-enterprise.yaml \
  --set gateway.ingress.host=guardian.example.com
```

`values-enterprise.yaml` enables `gateway.enabled`, ingress paths `/sse` and `/message`, and `GUARDIAN_SEMANTIC_ASYNC=true` for p99 SLO.

## Related

- [MULTI_TENANCY.md](./MULTI_TENANCY.md)
- [TRANSPORT.md](./TRANSPORT.md)
- [ENTERPRISE_DEPLOY.md](./ENTERPRISE_DEPLOY.md)
