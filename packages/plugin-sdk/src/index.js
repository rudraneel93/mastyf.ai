/**
 * MCP Guardian Detector Plugin SDK v3.0 — stable API for custom secret/argument scanners.
 * @see docs/PLUGIN_SDK.md
 */
/** Factory for typed plugins with lifecycle hooks. */
export function createDetectorPlugin(opts) {
    return {
        name: opts.name,
        version: opts.version,
        onLoad: opts.onLoad,
        onUnload: opts.onUnload,
        scanArguments: opts.scanArguments,
    };
}
/** SDK version string embedded in registry logs. */
export const PLUGIN_SDK_VERSION = '3.0.0';
//# sourceMappingURL=index.js.map