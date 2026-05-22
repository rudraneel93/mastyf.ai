/**
 * Hot-reloadable mTLS HTTPS agent registry.
 */
import { Agent as HttpsAgent } from 'https';
import { loadMtlsConfig, createMtlsAgent, type MtlsConfig } from './mtls-config.js';
import { Logger } from './logger.js';

let currentAgent: HttpsAgent | undefined;
let currentConfig: MtlsConfig | undefined;

export function getMtlsAgent(): HttpsAgent | undefined {
  if (!currentAgent) {
    currentConfig = loadMtlsConfig();
    currentAgent = createMtlsAgent(currentConfig);
  }
  return currentAgent;
}

export function reloadMtlsAgent(): void {
  try {
    currentConfig = loadMtlsConfig();
    const next = createMtlsAgent(currentConfig);
    if (currentAgent) {
      currentAgent.destroy();
    }
    currentAgent = next;
    Logger.info('[mtls] HTTPS agent reloaded after certificate rotation');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    Logger.error(`[mtls] Hot-reload failed: ${msg}`);
  }
}

export function resetMtlsAgentForTests(): void {
  currentAgent?.destroy();
  currentAgent = undefined;
  currentConfig = undefined;
}
