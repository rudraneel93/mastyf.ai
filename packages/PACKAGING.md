# Packaging Guide

| Package | Purpose |
|---------|---------|
| `@mastyf-ai/server` (root) | **Primary** — CLI, proxy, scanners |
| `@mastyf-ai/core` | Detection engine library |
| `@mastyf-ai/cli` | Thin CLI shim |

Enterprise deployments: use Docker/Helm with `@mastyf-ai/server` image or `npm install -g @mastyf-ai/server`.
