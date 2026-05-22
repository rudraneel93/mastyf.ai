/**
 * mTLS certificate file watcher (skeleton).
 *
 * Watches CA/cert/key paths and hot-reloads the shared mTLS HTTPS agent.
 */
import { watch, type FSWatcher } from 'fs';
import { Logger } from './logger.js';
import { reloadMtlsAgent } from './mtls-agent-registry.js';

export interface MtlsWatchPaths {
  caPath?: string;
  certPath?: string;
  keyPath?: string;
}

export class MtlsCertWatcher {
  private watchers: FSWatcher[] = [];

  start(paths: MtlsWatchPaths): void {
    const entries: Array<[string, string | undefined]> = [
      ['CA', paths.caPath],
      ['cert', paths.certPath],
      ['key', paths.keyPath],
    ];

    for (const [label, filePath] of entries) {
      if (!filePath) continue;
      try {
        const watcher = watch(filePath, () => {
          Logger.warn(`[mtls-watcher] ${label} file changed (${filePath}) — reloading mTLS agent`);
          reloadMtlsAgent();
        });
        this.watchers.push(watcher);
        Logger.info(`[mtls-watcher] Watching ${label}: ${filePath}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        Logger.warn(`[mtls-watcher] Could not watch ${filePath}: ${message}`);
      }
    }
  }

  stop(): void {
    for (const w of this.watchers) {
      try {
        w.close();
      } catch {
        /* ignore */
      }
    }
    this.watchers = [];
  }
}
