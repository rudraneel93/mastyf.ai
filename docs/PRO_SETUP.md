# MCP Guardian Pro — setup (buyers)

Thank you for purchasing **MCP Guardian Pro — Lifetime** ($4.99 one-time).

## What you received

- A **license key** in your Lemon Squeezy receipt email
- Lifetime use of Pro entitlement on **self-hosted** MCP Guardian (no recurring fee)

The open-source software is also available under MIT. **npm install is free** — you are paying to unlock **Pro runtime features**, not the download.

## Community vs Pro

| | Community (free) | Pro (your purchase) |
|--|------------------|---------------------|
| `npm install` | Yes | Yes |
| Proxy + policy block mode | Yes | Yes |
| CLI scan | Yes | Yes |
| Dashboard + live WebSocket | No | Yes |
| Security swarm / Analysis tab | No | Yes |
| Multi-tenant JWT binding | No | Yes |
| Semantic async audit (tier-2) | No | Yes |

## Install Guardian

```bash
npm install -g @mcp-guardian/server
# or clone: https://github.com/rudraneel93/mcp-guardian
```

See [README.md](../README.md) for proxy, dashboard, and policy setup.

## Activate your license

Add to your environment (`.env`, systemd, or Kubernetes secret):

```bash
GUARDIAN_LICENSE_KEY=<your-key-from-email>
GUARDIAN_CONTROL_PLANE_URL=https://your-vendor-cloud.example.com
# Optional hard fail at startup (enterprise):
# GUARDIAN_REQUIRE_LICENSE=true
```

Restart the proxy and dashboard after setting env vars.

## Cloud control plane (optional)

If your purchase includes a **cloud organization** (`gcp_...` API key), the vendor will email it separately or you will receive it in Settings after signing in at the cloud URL they provide.

1. Sign in at the cloud dashboard (Google/GitHub)
2. **Settings → Rotate API key** — copy the `gcp_...` key once
3. Set `GUARDIAN_LICENSE_KEY` to that key and `GUARDIAN_CONTROL_PLANE_URL` to the cloud base URL

## Support

Reply to your purchase receipt email or open a GitHub Discussion on [mcp-guardian](https://github.com/rudraneel93/mcp-guardian).

## Refunds

Per the seller’s Lemon Squeezy refund policy (typically within 14 days if the license has not been activated).
