# Extensibility

MCP Guardian is **opinionated and mostly built-in** today. Extensibility is incremental — not a full plugin platform yet.

## What exists today (v2.6.4)

| Capability | Status |
|------------|--------|
| **OPA / Rego** | Production hook via `OPA_URL` — external deny/allow (OPA **block** wins over YAML; see [POLICY.md](POLICY.md)) |
| **YAML policy** | Primary rule language — hot-reload via `PolicyWatcher` |
| **Detector plugins (experimental)** | Registry + optional dynamic load — v0.1, not v3.0 SDK |

## Detector plugin registry (experimental v0.1)

Built-in secret scanning remains the default. Custom detectors are **opt-in**:

```bash
export GUARDIAN_PLUGINS_ENABLED=true
export GUARDIAN_PLUGIN_PATH=/path/to/plugins   # optional — loads *.js
```

### Interface

```typescript
interface DetectorPlugin {
  name: string;
  scanArguments(text: string, ctx: DetectorScanContext): DetectorFinding[];
}

registerDetectorPlugin(plugin);  // or export default from a .js file in GUARDIAN_PLUGIN_PATH
```

Plugins run **after** built-in `scanForSecrets()` when enabled. See `examples/plugins/custom-secret-pattern.js`.

### Enterprise bootstrap

For bundled deployments, register plugins in process startup instead of dynamic import:

```typescript
import { registerDetectorPlugin } from '@mcp-guardian/server/dist/plugins/detector-plugin.js';
import { myPlugin } from './plugins/my-plugin.js';

registerDetectorPlugin(myPlugin);
```

## Planned (v3.0)

- Full custom detector SDK (versioned API, sandboxing, signing)
- Multi-tenant control plane
- gRPC transport

Until then, treat `GUARDIAN_PLUGINS_ENABLED` as **experimental** — test in staging before production.
