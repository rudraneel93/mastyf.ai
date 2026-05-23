# MCP Guardian Pro — setup (buyers)

Thank you for purchasing **MCP Guardian Pro — Lifetime** ($4.99 one-time).

## What you received

| Item | Where |
|------|--------|
| **License key** | Lemon Squeezy receipt email (`{license_key}`) |
| **Control plane URL** | Fixed vendor URL below (same for all buyers — not generated per purchase) |
| **Setup guide** | This page |

Lifetime use of Pro entitlement on **self-hosted** MCP Guardian (no recurring fee).

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
GUARDIAN_CONTROL_PLANE_URL=https://mcp-guardian-cloud.vercel.app
# Optional hard fail at startup (enterprise):
# GUARDIAN_REQUIRE_LICENSE=true
```

**`GUARDIAN_CONTROL_PLANE_URL`** is the public MCP Guardian Cloud base URL where your license is validated (`GET /api/v1/license`). It is **not** unique to your account — every Pro buyer uses the same URL. Lemon Squeezy emails only the license key; copy the control plane URL from this guide.

Restart the proxy and dashboard after setting env vars.

### Verify

```bash
curl -s -H "Authorization: Bearer YOUR-LICENSE-KEY" \
  https://mcp-guardian-cloud.vercel.app/api/v1/license | jq .
# Expect: "licensed": true
```

## Cloud control plane (optional)

Free sign-in at [mcp-guardian-cloud.vercel.app](https://mcp-guardian-cloud.vercel.app) is optional — for policy editor, API keys, and tenant env snippets. **Pro license validation does not require OAuth.**

If you prefer a **cloud org API key** (`gcp_...`) instead of the Lemon Squeezy key:

1. Sign in at [mcp-guardian-cloud.vercel.app/login](https://mcp-guardian-cloud.vercel.app/login) (Google/GitHub)
2. **Settings → Rotate API key** — copy the `gcp_...` key once
3. Set `GUARDIAN_LICENSE_KEY` to that key and keep `GUARDIAN_CONTROL_PLANE_URL=https://mcp-guardian-cloud.vercel.app`

## Support

Reply to your purchase receipt email or open a GitHub Discussion on [mcp-guardian](https://github.com/rudraneel93/mcp-guardian).

## Refunds

Per the seller’s Lemon Squeezy refund policy (typically within 14 days if the license has not been activated).
