/**
 * False-positive whitelist — after N human confirmations, skip matching rule+pattern blocks.
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { Logger } from '../utils/logger.js';

export interface FpWhitelistEntry {
  rule: string;
  pattern: string;
  fingerprint: string;
  confirmedAt: string;
  confirmCount: number;
}

export interface FpWhitelistFile {
  version: 1;
  entries: FpWhitelistEntry[];
}

const DEFAULT_THRESHOLD = parseInt(process.env.GUARDIAN_FP_WHITELIST_THRESHOLD || '3', 10);

function resolveWhitelistPath(): string {
  if (process.env.GUARDIAN_FP_WHITELIST_PATH) {
    return process.env.GUARDIAN_FP_WHITELIST_PATH;
  }
  return join(homedir(), '.mcp-guardian', '.fp-whitelist.json');
}

export function fpFingerprint(rule: string, pattern: string): string {
  return createHash('sha256').update(`${rule}\0${pattern}`).digest('hex').slice(0, 16);
}

function loadFile(): FpWhitelistFile {
  const path = resolveWhitelistPath();
  if (!existsSync(path)) {
    return { version: 1, entries: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as FpWhitelistFile;
    if (parsed.version === 1 && Array.isArray(parsed.entries)) return parsed;
  } catch {
    Logger.warn('[fp-whitelist] Corrupt whitelist file — resetting');
  }
  return { version: 1, entries: [] };
}

function saveFile(data: FpWhitelistFile): void {
  const path = resolveWhitelistPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

/** In-memory pending confirmations (rule+pattern → count) before persistence. */
const pendingCounts = new Map<string, number>();

/**
 * Record a false-positive rejection from TUI/dashboard.
 * After threshold confirmations, persists to ~/.mcp-guardian/.fp-whitelist.json.
 */
export function recordFpRejection(rule: string, pattern: string): {
  fingerprint: string;
  confirmCount: number;
  whitelisted: boolean;
} {
  const fingerprint = fpFingerprint(rule, pattern);
  const key = fingerprint;
  const threshold = DEFAULT_THRESHOLD;
  const file = loadFile();
  const existing = file.entries.find((e) => e.fingerprint === fingerprint);
  if (existing) {
    return { fingerprint, confirmCount: existing.confirmCount, whitelisted: true };
  }

  const next = (pendingCounts.get(key) ?? 0) + 1;
  pendingCounts.set(key, next);

  if (next >= threshold) {
    file.entries.push({
      rule,
      pattern,
      fingerprint,
      confirmedAt: new Date().toISOString(),
      confirmCount: next,
    });
    saveFile(file);
    pendingCounts.delete(key);
    Logger.info(`[fp-whitelist] Whitelisted after ${next} confirmations: ${rule} / ${pattern}`);
    return { fingerprint, confirmCount: next, whitelisted: true };
  }

  Logger.debug(`[fp-whitelist] FP confirm ${next}/${threshold} for ${rule} / ${pattern}`);
  return { fingerprint, confirmCount: next, whitelisted: false };
}

export function isFpWhitelisted(rule: string, pattern: string): boolean {
  const fingerprint = fpFingerprint(rule, pattern);
  const file = loadFile();
  return file.entries.some((e) => e.fingerprint === fingerprint);
}

export function listFpWhitelist(): FpWhitelistEntry[] {
  return loadFile().entries;
}

export function clearFpWhitelistForTests(): void {
  pendingCounts.clear();
  const path = resolveWhitelistPath();
  if (existsSync(path)) {
    writeFileSync(path, JSON.stringify({ version: 1, entries: [] }, null, 2), 'utf-8');
  }
}
