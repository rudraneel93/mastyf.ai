# Penetration Test Scope — MCP Guardian v2.5

## In scope
- OAuth/JWT validation (`src/auth/oauth.ts`)
- Policy bypass (encoding, injection)
- Dashboard API with `DASHBOARD_AUTH_ENABLED=true`
- HTTP proxy (`src/proxy/http-proxy-server.ts`)
- Redis session HA when `REDIS_URL` is set

## Out of scope
- Upstream MCP server vulnerabilities
- DPoP (not enabled by default)
- Experimental AI unless `GUARDIAN_EXPERIMENTAL_AI=true`
