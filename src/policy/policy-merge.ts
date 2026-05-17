import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load } from 'js-yaml';
import type { PolicyConfig, PolicyRule } from './policy-types.js';
import { Logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HTTP_TOOLS_TEMPLATE_CANDIDATES = [
  resolve(process.cwd(), 'policy-templates', 'http-tools-policy.yaml'),
  resolve(__dirname, '..', '..', 'policy-templates', 'http-tools-policy.yaml'),
  resolve(__dirname, '..', 'policy-templates', 'http-tools-policy.yaml'),
];

export function resolveHttpToolsPolicyPath(): string | null {
  const explicit = process.env['GUARDIAN_HTTP_TOOLS_POLICY_PATH'];
  if (explicit && existsSync(explicit)) return explicit;
  for (const p of HTTP_TOOLS_TEMPLATE_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function isHttpToolsPolicyMergeEnabled(): boolean {
  return process.env['GUARDIAN_HTTP_TOOLS_POLICY'] === 'true';
}

function dedupeRules(rules: PolicyRule[]): PolicyRule[] {
  const seen = new Set<string>();
  const out: PolicyRule[] = [];
  for (const r of rules) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    out.push(r);
  }
  return out;
}

/** Append HTTP tools SSRF rules from template when GUARDIAN_HTTP_TOOLS_POLICY=true. */
export function mergeHttpToolsPolicy(base: PolicyConfig): PolicyConfig {
  if (!isHttpToolsPolicyMergeEnabled()) return base;

  const templatePath = resolveHttpToolsPolicyPath();
  if (!templatePath) {
    Logger.warn('[policy-merge] GUARDIAN_HTTP_TOOLS_POLICY=true but http-tools-policy.yaml not found');
    return base;
  }

  try {
    const overlay = load(readFileSync(templatePath, 'utf-8')) as PolicyConfig;
    const overlayRules = overlay?.policy?.rules ?? [];
    if (overlayRules.length === 0) return base;

    const merged: PolicyConfig = {
      ...base,
      policy: {
        ...base.policy,
        rules: dedupeRules([...base.policy.rules, ...overlayRules]),
      },
    };
    Logger.info(`[policy-merge] Merged ${overlayRules.length} HTTP tools rule(s) from ${templatePath}`);
    return merged;
  } catch (err: any) {
    Logger.warn(`[policy-merge] Failed to merge HTTP tools policy: ${err?.message}`);
    return base;
  }
}

export function applyPolicyMerges(raw: PolicyConfig): PolicyConfig {
  return mergeHttpToolsPolicy(raw);
}
