import { detectPromptInjection } from '../scanners/prompt-injection-detector.js';
import { deobfuscateRecursive } from '../utils/payload-normalizer.js';
import { isFpWhitelisted } from '../ai/fp-whitelist.js';
import { evaluatePathGuard, extractPathArgumentValues } from './path-guard.js';
import {
  evaluateUrlGuard,
  extractHttpUrlsFromLeaves,
  extractUrlArgumentValues,
} from './url-guard.js';
import type { CallContext, PolicyDecision } from './policy-types.js';

const SQL_ARG_FIELDS = new Set(['sql', 'query']);
const REPO_ARG_FIELDS = new Set(['repo', 'repository', 'owner']);

const SQL_EXFIL_PATTERNS: RegExp[] = [
  /\bselect\b.+\bfrom\b.+\b(accounts|customers|users|credentials|secrets|payments|transactions|admin_users|passwords)\b/i,
  /\b(?:drop|truncate)\s+(?:table|database)\b/i,
  /\bdelete\s+from\b.+\bwhere\s+1\s*=\s*1\b/i,
  /\bunion\b.+\bselect\b/i,
  /\bload_file\s*\(/i,
  /\bsleep\s*\(/i,
  /\bbenchmark\s*\(/i,
  /"\$where"\s*:/i,
  /"\$gt"\s*:/i,
  /"\$regex"\s*:/i,
  /\$where\b/i,
  /\$gt\b/i,
  /\$regex\b/i,
  /__schema\b/i,
  /\bintrospection\b/i,
  /\*\)\s*\(/,
  /\|\s*\(/,
  /\)\s*\)\s*\(/,
];

const POWERSHELL_PATTERNS: RegExp[] = [
  /\bpowershell(?:\.exe)?\b/i,
  /\bpwsh\b/i,
  /-enc(?:odedcommand)?\b/i,
  /\biex\b/i,
];

const SSTI_PATTERNS: RegExp[] = [
  /\{\{/,
  /\$\{/,
  /<%/,
  /#\{/,
];

const MULTILINE_INJECTION_PATTERNS: RegExp[] = [
  /ignore[\s\S]{0,80}(?:previous|all|your)[\s\S]{0,80}instructions/i,
  /(?:system|assistant)[\s\S]{0,40}:\s*you\s+are/i,
  /<\|(?:endoftext|im_start|im_end)\|>/i,
];

function extractFieldValues(args: Record<string, unknown> | undefined, fields: Set<string>): string[] {
  if (!args) return [];
  const out: string[] = [];
  for (const [key, val] of Object.entries(args)) {
    if (!fields.has(key.toLowerCase())) continue;
    if (typeof val === 'string') out.push(val);
  }
  return out;
}

function extractAllLeafStrings(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj];
  if (obj === null || obj === undefined) return [];
  if (Array.isArray(obj)) return obj.flatMap(extractAllLeafStrings);
  if (typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).flatMap(extractAllLeafStrings);
  }
  return [];
}

function githubAllowedRepos(): string[] | null {
  const repos = process.env.GUARDIAN_GITHUB_ALLOWED_REPOS?.split(',').map((s) => s.trim()).filter(Boolean);
  if (repos?.length) return repos;
  const orgs = process.env.GUARDIAN_GITHUB_ALLOWED_ORGS?.split(',').map((s) => s.trim()).filter(Boolean);
  if (orgs?.length) return orgs.map((o) => `${o}/`);
  return null;
}

function repoAllowed(repo: string, allowed: string[]): boolean {
  const r = repo.toLowerCase();
  return allowed.some((a) => {
    const p = a.toLowerCase();
    if (p.endsWith('/')) return r.startsWith(p) || r === p.slice(0, -1);
    return r === p;
  });
}

/**
 * Semantic abuse checks (paths, SQL exfil, GitHub repo scope, prompt injection, PowerShell).
 * Runs on normalized arguments before per-rule regex evaluation.
 */
export function evaluateSemanticGuards(ctx: CallContext): PolicyDecision | null {
  const args = ctx.arguments ?? {};

  const pathCheck = evaluatePathGuard(extractPathArgumentValues(args));
  if (pathCheck.block) {
    return { action: 'block', rule: 'semantic-path-guard', reason: pathCheck.reason! };
  }

  const urlCandidates = [
    ...extractUrlArgumentValues(args, ctx.toolName),
    ...extractHttpUrlsFromLeaves(args),
  ];
  const urlCheck = evaluateUrlGuard([...new Set(urlCandidates)]);
  if (urlCheck.block) {
    return { action: 'block', rule: 'semantic-url-guard', reason: urlCheck.reason! };
  }

  for (const sql of extractFieldValues(args, SQL_ARG_FIELDS)) {
    const decodedSql = deobfuscateRecursive(sql);
    for (const pattern of SQL_EXFIL_PATTERNS) {
      if (pattern.test(decodedSql)) {
        return {
          action: 'block',
          rule: 'semantic-sql-guard',
          reason: `SQL pattern blocked in tool '${ctx.toolName}'`,
        };
      }
    }
  }

  const allowedRepos = githubAllowedRepos();
  if (allowedRepos) {
    for (const repo of extractFieldValues(args, REPO_ARG_FIELDS)) {
      if (!repoAllowed(repo, allowedRepos)) {
        return {
          action: 'block',
          rule: 'semantic-github-guard',
          reason: `GitHub repo '${repo}' not in allowlist`,
        };
      }
    }
  } else {
    for (const repo of extractFieldValues(args, REPO_ARG_FIELDS)) {
      if (/(?:attacker|honeypot|evil|malware|exfil)/i.test(repo)) {
        return {
          action: 'block',
          rule: 'semantic-github-guard',
          reason: `Suspicious GitHub repo target: ${repo}`,
        };
      }
    }
  }

  const argsBlob = deobfuscateRecursive(JSON.stringify(args));
  for (const pattern of POWERSHELL_PATTERNS) {
    if (pattern.test(argsBlob)) {
      return {
        action: 'block',
        rule: 'semantic-powershell-guard',
        reason: 'PowerShell execution pattern detected in arguments',
      };
    }
  }

  for (const pattern of SSTI_PATTERNS) {
    if (pattern.test(argsBlob)) {
      return {
        action: 'block',
        rule: 'semantic-ssti-guard',
        reason: 'Server-side template injection pattern detected in arguments',
      };
    }
  }

  const injectionTextFields = new Set([
    'query', 'body', 'title', 'description', 'message', 'content', 'prompt', 'instruction', 'text',
  ]);
  const injectionBlob = Object.entries(args)
    .filter(([k]) => injectionTextFields.has(k.toLowerCase()))
    .flatMap(([, v]) => extractAllLeafStrings(v).map((s) => deobfuscateRecursive(s)))
    .join('\n');
  if (injectionBlob.trim()) {
    for (const pattern of MULTILINE_INJECTION_PATTERNS) {
      if (pattern.test(injectionBlob)) {
        return {
          action: 'block',
          rule: 'semantic-prompt-injection',
          reason: 'Multi-line prompt injection pattern in arguments',
        };
      }
    }
    const criticalInjection = detectPromptInjection(ctx.toolName, injectionBlob)
      .filter((f) => f.severity === 'critical');
    if (criticalInjection.length > 0) {
      const rule = 'semantic-prompt-injection';
      const patternId = criticalInjection[0].patternId;
      if (!isFpWhitelisted(rule, patternId)) {
        return {
          action: 'block',
          rule,
          reason: `Prompt injection in arguments: ${patternId}`,
        };
      }
    }
  }

  return null;
}
