/**
 * Enterprise response DLP — output filtering for tool results (secrets, PII, exfil markers).
 */
import { detectPromptInjection } from '../scanners/prompt-injection-detector.js';
import { scanForSecrets } from '../scanners/secret-scanner.js';
import { MAX_RESPONSE_DLP_BYTES, truncateForPolicy, utf8ByteLength } from '../utils/eval-bounds.js';

export type DlpSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ResponseDlpFinding {
  category: 'secret' | 'pii' | 'injection' | 'exfil' | 'sensitive-content';
  severity: DlpSeverity;
  ruleId: string;
  message: string;
}

export interface ResponseDlpResult {
  clean: boolean;
  findings: ResponseDlpFinding[];
  hasCritical: boolean;
  hasHigh: boolean;
  truncated: boolean;
  scannedBytes: number;
}

const PII_PATTERNS: Array<{ id: string; severity: DlpSeverity; regex: RegExp }> = [
  {
    id: 'pii-ssn',
    severity: 'high',
    regex: /\b\d{3}-\d{2}-\d{4}\b/,
  },
  {
    id: 'pii-credit-card',
    severity: 'high',
    regex: /\b(?:\d{4}[- ]?){3}\d{4}\b/,
  },
  {
    id: 'pii-email-bulk',
    severity: 'medium',
    regex: /(?:[\w.+-]+@[\w.-]+\.\w{2,}[\s,;]){5,}/i,
  },
];

const SENSITIVE_CONTENT_MARKERS: Array<{ id: string; severity: DlpSeverity; regex: RegExp }> = [
  { id: 'content-passwd', severity: 'critical', regex: /root:.*?:\/bin\// },
  { id: 'content-aws-key', severity: 'critical', regex: /AKIA[0-9A-Z]{16}/ },
  { id: 'content-private-key', severity: 'critical', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: 'content-connection-string', severity: 'high', regex: /(?:postgres|mysql|mongodb)(?:\+srv)?:\/\/[^:]+:[^@\s]+@/i },
];

const RESPONSE_EXFIL_PATTERNS: RegExp[] = [
  /\b(?:curl|wget|fetch)\b.*\bhttps?:\/\/[^\s"']+/i,
  /\$\(\s*(?:cat|head|tail)\s+.*(?:\.env|credentials|id_rsa)/i,
  /\b(?:send|post|upload|transmit)\b.*\b(?:secret|password|credential|api[_-]?key)/i,
];

function scanPii(text: string): ResponseDlpFinding[] {
  const out: ResponseDlpFinding[] = [];
  for (const { id, severity, regex } of PII_PATTERNS) {
    if (regex.test(text)) {
      out.push({
        category: 'pii',
        severity,
        ruleId: id,
        message: `PII pattern ${id} in tool response`,
      });
    }
  }
  return out;
}

function scanSensitiveMarkers(text: string): ResponseDlpFinding[] {
  const out: ResponseDlpFinding[] = [];
  for (const { id, severity, regex } of SENSITIVE_CONTENT_MARKERS) {
    if (regex.test(text)) {
      out.push({
        category: 'sensitive-content',
        severity,
        ruleId: id,
        message: `Sensitive content marker ${id} in response`,
      });
    }
  }
  return out;
}

/**
 * Full response DLP scan — used by PolicyEngine.evaluateResponse and streaming inspector.
 */
export function evaluateResponseDlp(
  toolName: string,
  serverName: string,
  responseBody: string | null | undefined,
): ResponseDlpResult {
  if (responseBody == null || typeof responseBody !== 'string') {
    return { clean: true, findings: [], hasCritical: false, hasHigh: false, truncated: false, scannedBytes: 0 };
  }

  let truncated = false;
  let body = responseBody;
  if (utf8ByteLength(body) > MAX_RESPONSE_DLP_BYTES) {
    const ratio = MAX_RESPONSE_DLP_BYTES / utf8ByteLength(body);
    body = body.slice(0, Math.floor(body.length * ratio));
    truncated = true;
  }
  const { text: scanText, truncated: charTrunc } = truncateForPolicy(body, MAX_RESPONSE_DLP_BYTES);
  truncated = truncated || charTrunc;

  const findings: ResponseDlpFinding[] = [];
  const ctx = `response:${serverName}:${toolName}`;

  for (const f of detectPromptInjection(toolName, scanText)) {
    const sev: DlpSeverity =
      f.severity === 'critical' ? 'critical' : f.severity === 'high' ? 'high' : 'medium';
    findings.push({
      category: 'injection',
      severity: sev,
      ruleId: f.patternId,
      message: `Prompt injection in response (${f.severity}): ${f.description}`,
    });
  }

  for (const f of scanForSecrets(scanText, ctx)) {
    const sev: DlpSeverity = f.severity === 'HIGH' ? 'high' : 'medium';
    findings.push({
      category: 'secret',
      severity: sev,
      ruleId: f.type,
      message: `Secret (${f.severity}): ${f.type} in tool response`,
    });
  }

  findings.push(...scanPii(scanText));
  findings.push(...scanSensitiveMarkers(scanText));

  for (const pattern of RESPONSE_EXFIL_PATTERNS) {
    if (pattern.test(scanText)) {
      findings.push({
        category: 'exfil',
        severity: 'high',
        ruleId: 'response-exfil-pattern',
        message: `Data exfiltration marker in response: ${pattern.source.slice(0, 60)}`,
      });
      break;
    }
  }

  const b64chunks = [...scanText.matchAll(/[A-Za-z0-9+/]{100,}={0,2}/g)];
  for (const chunk of b64chunks.slice(0, 8)) {
    try {
      const decoded = Buffer.from(chunk[0], 'base64').toString('utf-8');
      if (/\b(bash|sh|cmd|powershell|eval|exec|curl|wget)\b/.test(decoded)) {
        findings.push({
          category: 'exfil',
          severity: 'high',
          ruleId: 'response-b64-shell',
          message: 'Base64-encoded shell command in response',
        });
        break;
      }
    } catch {
      /* ignore */
    }
  }

  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasHigh = findings.some((f) => f.severity === 'high');

  return {
    clean: findings.length === 0,
    findings,
    hasCritical,
    hasHigh,
    truncated,
    scannedBytes: utf8ByteLength(scanText),
  };
}

export function responseDlpToLegacyDetections(result: ResponseDlpResult): string[] {
  return result.findings.map((f) => f.message);
}
