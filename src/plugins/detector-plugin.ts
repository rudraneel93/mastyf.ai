import { readdirSync } from 'fs';
import { join, extname } from 'path';
import { pathToFileURL } from 'url';
import type { SecretFinding } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface DetectorScanContext {
  serverName?: string;
  toolName?: string;
  location?: string;
}

export interface DetectorFinding {
  type: string;
  location: string;
  severity: 'HIGH' | 'MEDIUM' | 'high' | 'medium';
  redacted?: string;
  context?: string;
  method?: string;
}

/** Experimental v0.1 plugin hook — full SDK planned for v3.0. */
export interface DetectorPlugin {
  name: string;
  scanArguments(text: string, ctx: DetectorScanContext): DetectorFinding[];
}

const registry: DetectorPlugin[] = [];

export function registerDetectorPlugin(plugin: DetectorPlugin): void {
  if (registry.some((p) => p.name === plugin.name)) {
    Logger.warn(`[plugins] detector '${plugin.name}' already registered — skipping duplicate`);
    return;
  }
  registry.push(plugin);
  Logger.info(`[plugins] registered detector '${plugin.name}'`);
}

export function getRegisteredDetectorPlugins(): readonly DetectorPlugin[] {
  return registry;
}

export function clearDetectorPluginsForTests(): void {
  registry.length = 0;
}

function toSecretFinding(f: DetectorFinding, ctx: DetectorScanContext): SecretFinding {
  return {
    type: f.type,
    location: f.location || ctx.location || 'plugin',
    severity: f.severity,
    redacted: f.redacted,
    context: f.context ?? ctx.location,
    method: (f.method as SecretFinding['method']) || 'regex',
  };
}

/** Run registered plugins when GUARDIAN_PLUGINS_ENABLED=true. */
export function runDetectorPlugins(text: string, ctx: DetectorScanContext): SecretFinding[] {
  if (process.env['GUARDIAN_PLUGINS_ENABLED'] !== 'true') return [];
  const findings: SecretFinding[] = [];
  for (const plugin of registry) {
    try {
      for (const f of plugin.scanArguments(text, ctx)) {
        findings.push(toSecretFinding(f, ctx));
      }
    } catch (err: any) {
      Logger.warn(`[plugins] detector '${plugin.name}' failed: ${err?.message}`);
    }
  }
  return findings;
}

/** Load *.js plugins from GUARDIAN_PLUGIN_PATH (optional). */
export async function loadDetectorPluginsFromPath(): Promise<void> {
  const dir = process.env['GUARDIAN_PLUGIN_PATH'];
  if (!dir || process.env['GUARDIAN_PLUGINS_ENABLED'] !== 'true') return;

  let entries: string[];
  try {
    entries = readdirSync(dir).filter((f) => extname(f) === '.js' && !f.startsWith('_'));
  } catch (err: any) {
    Logger.warn(`[plugins] cannot read GUARDIAN_PLUGIN_PATH=${dir}: ${err?.message}`);
    return;
  }

  for (const file of entries) {
    try {
      const mod = await import(pathToFileURL(join(dir, file)).href);
      const plugin: DetectorPlugin | undefined = mod.default ?? mod.plugin;
      if (plugin?.name && typeof plugin.scanArguments === 'function') {
        registerDetectorPlugin(plugin);
      } else {
        Logger.warn(`[plugins] ${file} does not export a valid DetectorPlugin`);
      }
    } catch (err: any) {
      Logger.warn(`[plugins] failed to load ${file}: ${err?.message}`);
    }
  }
}
