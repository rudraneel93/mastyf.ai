# @mcp-guardian/plugin-sdk

Stable v3.0 detector plugin API for MCP Guardian.

```bash
pnpm add @mcp-guardian/plugin-sdk
```

```typescript
import { createDetectorPlugin } from '@mcp-guardian/plugin-sdk';

export default createDetectorPlugin({
  name: 'acme-pii-scanner',
  version: '1.0.0',
  onLoad() { console.error('[acme] loaded'); },
  scanArguments(text, ctx) {
    if (/SSN-\d{3}-\d{2}-\d{4}/.test(text)) {
      return [{ type: 'ssn', location: ctx.location || 'args', severity: 'HIGH', redacted: 'SSN-[REDACTED]' }];
    }
    return [];
  },
});
```

Enable at runtime:

```bash
export GUARDIAN_PLUGINS_ENABLED=true
export GUARDIAN_PLUGIN_PATH=/path/to/built/plugins
```

See [docs/PLUGIN_SDK.md](../../docs/PLUGIN_SDK.md) for publishing and lifecycle details.
