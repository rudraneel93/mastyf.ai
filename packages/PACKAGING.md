# Packaging Guide

| Package | Purpose |
|---------|---------|
| `@mcp-guardian/server` (root) | **Primary** — CLI, proxy, scanners |
| `@mcp-guardian/core` | Detection engine library |
| `@mcp-guardian/cli` | Thin CLI shim |

Enterprise deployments: use Docker/Helm with `@mcp-guardian/server` image or `npm install -g @mcp-guardian/server`.
