/**
 * Chunked streaming inspection for large tool responses (SSE/WS/stdio).
 * Scans 64KB windows with overlap so patterns spanning chunk boundaries are caught.
 */
import { detectPromptInjection } from '../scanners/prompt-injection-detector.js';
import { scanForSecrets } from '../scanners/secret-scanner.js';
import type { PolicyEngine } from '../policy/policy-engine.js';
import type { InjectionFinding } from '../scanners/prompt-injection-detector.js';
import type { SecretFinding } from '../types.js';

export const STREAMING_INSPECTOR_CHUNK_BYTES = 64 * 1024;
export const STREAMING_INSPECTOR_OVERLAP_BYTES = 512;

export interface StreamingInspectFinding {
  source: 'policy' | 'injection' | 'secret';
  message: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

export interface StreamingInspectResult {
  clean: boolean;
  findings: StreamingInspectFinding[];
  hasCritical: boolean;
  hasHigh: boolean;
}

export interface StreamingInspectorState {
  carry: string;
  findings: StreamingInspectFinding[];
}

export function createStreamingInspectorState(): StreamingInspectorState {
  return { carry: '', findings: [] };
}

export function isResponseScanSkipped(): boolean {
  return process.env['GUARDIAN_SKIP_RESPONSE_SCAN'] === 'true';
}

function mergeInjectionFindings(
  state: StreamingInspectorState,
  toolName: string,
  text: string,
): void {
  const found = detectPromptInjection(toolName, text);
  for (const f of found) {
    const key = `injection:${f.patternId}`;
    if (state.findings.some((x) => x.message === key)) continue;
    state.findings.push({
      source: 'injection',
      message: key,
      severity: f.severity,
    });
  }
}

function mergeSecretFindings(state: StreamingInspectorState, text: string, ctx: string): void {
  const found = scanForSecrets(text, ctx);
  for (const f of found) {
    const key = `secret:${f.type}:${f.location}`;
    if (state.findings.some((x) => x.message === key)) continue;
    const sev = String(f.severity).toLowerCase();
    state.findings.push({
      source: 'secret',
      message: key,
      severity: sev === 'high' ? 'high' : 'medium',
    });
  }
}

function mergePolicyFindings(
  state: StreamingInspectorState,
  policy: PolicyEngine,
  toolName: string,
  serverName: string,
  text: string,
): void {
  const { clean, detections } = policy.evaluateResponse(toolName, serverName, text);
  if (clean) return;
  for (const d of detections) {
    if (!state.findings.some((x) => x.source === 'policy' && x.message === d)) {
      state.findings.push({ source: 'policy', message: d, severity: 'high' });
    }
  }
}

/** Feed a chunk of response text; returns incremental findings for this chunk only. */
export function inspectResponseChunk(
  state: StreamingInspectorState,
  chunk: string,
  opts: {
    toolName: string;
    serverName: string;
    policy?: PolicyEngine | null;
    scanSecrets?: boolean;
  },
): StreamingInspectFinding[] {
  if (!chunk) return [];
  const combined = state.carry + chunk;
  const chunkSize = STREAMING_INSPECTOR_CHUNK_BYTES;
  const newFindings: StreamingInspectFinding[] = [];
  const before = state.findings.length;

  let offset = 0;
  while (offset < combined.length) {
    const window = combined.slice(offset, offset + chunkSize);
    if (opts.policy) {
      mergePolicyFindings(state, opts.policy, opts.toolName, opts.serverName, window);
    }
    mergeInjectionFindings(state, opts.toolName, window);
    if (opts.scanSecrets !== false) {
      mergeSecretFindings(state, window, `stream:${opts.serverName}:${opts.toolName}`);
    }
    offset += chunkSize - STREAMING_INSPECTOR_OVERLAP_BYTES;
    if (offset <= 0 || chunkSize <= STREAMING_INSPECTOR_OVERLAP_BYTES) break;
  }

  const tailStart = Math.max(0, combined.length - STREAMING_INSPECTOR_OVERLAP_BYTES);
  state.carry = combined.slice(tailStart);

  for (let i = before; i < state.findings.length; i++) {
    newFindings.push(state.findings[i]);
  }
  return newFindings;
}

/** Inspect full response text using chunked windows (for stdio single-line responses). */
export function inspectFullResponse(
  responseText: string,
  opts: {
    toolName: string;
    serverName: string;
    policy?: PolicyEngine | null;
    scanSecrets?: boolean;
  },
): StreamingInspectResult {
  if (isResponseScanSkipped()) {
    return { clean: true, findings: [], hasCritical: false, hasHigh: false };
  }

  const state = createStreamingInspectorState();
  if (responseText.length <= STREAMING_INSPECTOR_CHUNK_BYTES) {
    inspectResponseChunk(state, responseText, opts);
    return finalizeStreamingInspect(state);
  }
  const chunkSize = STREAMING_INSPECTOR_CHUNK_BYTES;
  const step = chunkSize - STREAMING_INSPECTOR_OVERLAP_BYTES;
  for (let i = 0; i < responseText.length; i += step) {
    inspectResponseChunk(state, responseText.slice(i, i + chunkSize), opts);
  }
  return finalizeStreamingInspect(state);
}

export function finalizeStreamingInspect(state: StreamingInspectorState): StreamingInspectResult {
  const hasCritical = state.findings.some((f) => f.severity === 'critical');
  const hasHigh = state.findings.some((f) => f.severity === 'high');
  return {
    clean: state.findings.length === 0,
    findings: state.findings,
    hasCritical,
    hasHigh,
  };
}

export function findingsToMessages(findings: StreamingInspectFinding[]): string[] {
  return findings.map((f) => {
    if (f.source === 'injection') return f.message.replace(/^injection:/, 'PI: ');
    if (f.source === 'secret') return f.message.replace(/^secret:/, 'Secret: ');
    return f.message;
  });
}

export type { InjectionFinding, SecretFinding };
