# Extensibility

## Production (v2.7)

| Capability | Status |
|------------|--------|
| **OPA / Rego** | `OPA_URL` — block wins over YAML ([POLICY.md](POLICY.md)) |
| **YAML policy** | Hot-reload via `PolicyWatcher` |
| **Detector Plugin SDK v3.0** | `@mcp-guardian/plugin-sdk` — [PLUGIN_SDK.md](PLUGIN_SDK.md) |
| **HTTP tools template** | `GUARDIAN_HTTP_TOOLS_POLICY=true` |

## Detector plugins

On by default in v2.7. Disable with `GUARDIAN_PLUGINS_ENABLED=false`.

```bash
export GUARDIAN_PLUGIN_PATH=/path/to/plugins
```

See `examples/plugins/custom-secret-pattern.js` and [PLUGIN_SDK.md](PLUGIN_SDK.md).

## Roadmap

- Signed plugin distribution
- Sandboxed plugin runtime
- gRPC transport
