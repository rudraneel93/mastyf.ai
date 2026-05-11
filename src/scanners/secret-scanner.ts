/**
 * Secret scanner — detects hardcoded credentials in MCP server configs.
 *
 * Fix 8: Expanded from 6 to 40+ patterns covering:
 * - Cloud provider keys (AWS, Azure, GCP)
 * - SaaS service tokens (GitHub, GitLab, Slack, Stripe, Twilio, SendGrid, Mailchimp, HuggingFace, Notion, Airtable, Supabase, Planetscale, Neon, Upstash, Vercel, Netlify, Heroku, npm)
 * - Database connection strings
 * - Generic credential formats
 * - Private keys and certificates
 */
import { McpServerConfig, SecretFinding } from '../types.js';

interface SecretPattern {
  type: string;
  regex: RegExp;
  severity: 'HIGH' | 'MEDIUM';
}

const PATTERNS: SecretPattern[] = [
  // ── Cloud Providers ──────────────────────────────────────
  { type: 'aws_access_key',    regex: /AKIA[0-9A-Z]{16}/,                                    severity: 'HIGH' },
  { type: 'aws_secret_key',    regex: /[A-Za-z0-9/+=]{40}/,                                    severity: 'HIGH' },
  { type: 'gcp_service_key',   regex: /"type":\s*"service_account"/,                           severity: 'HIGH' },
  { type: 'gcp_api_key',       regex: /AIza[0-9A-Za-z\-_]{35}/,                                severity: 'HIGH' },
  { type: 'azure_connection',  regex: /AccountName=([^;]+);AccountKey=([^;]+);DefaultEndpointsProtocol/, severity: 'HIGH' },
  { type: 'azure_key',         regex: /[a-f0-9]{32}\+[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/, severity: 'MEDIUM' },

  // ── GitHub / GitLab ──────────────────────────────────────
  { type: 'github_token',      regex: /gh[pousr]_[A-Za-z0-9_]{36,}/,                           severity: 'HIGH' },
  { type: 'github_oauth',      regex: /gho_[A-Za-z0-9]{36,}/,                                   severity: 'HIGH' },
  { type: 'github_app_key',    regex: /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?gh[a-z]_/,        severity: 'HIGH' },
  { type: 'gitlab_token',      regex: /glpat-[A-Za-z0-9\-_]{20,}/,                              severity: 'HIGH' },

  // ── Stripe / Payments ────────────────────────────────────
  { type: 'stripe_live',       regex: /sk_live_[A-Za-z0-9]{24,}/,                               severity: 'HIGH' },
  { type: 'stripe_test',       regex: /(?:sk|rk)_test_[A-Za-z0-9]{24,}/,                        severity: 'MEDIUM' },

  // ── Slack / Communication ────────────────────────────────
  { type: 'slack_token',       regex: /xox[baprs]-[0-9]{10,}-[0-9]{10,}-[A-Za-z0-9]*/,        severity: 'HIGH' },
  { type: 'slack_webhook',     regex: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/,   severity: 'HIGH' },

  // ── Twilio ───────────────────────────────────────────────
  { type: 'twilio_sid',        regex: /AC[a-f0-9]{32}/,                                         severity: 'MEDIUM' },
  { type: 'twilio_auth',       regex: /SK[a-f0-9]{32}/,                                         severity: 'HIGH' },

  // ── SendGrid / Email ─────────────────────────────────────
  { type: 'sendgrid_key',      regex: /SG\.[A-Za-z0-9\-_]{22,}\.[A-Za-z0-9\-_]{43,}/,          severity: 'HIGH' },
  { type: 'mailchimp_key',     regex: /[a-f0-9]{32}-us[0-9]{1,2}/,                              severity: 'MEDIUM' },

  // ── HuggingFace ──────────────────────────────────────────
  { type: 'huggingface_token', regex: /hf_[A-Za-z]{32,}/,                                       severity: 'HIGH' },

  // ── Notion / Airtable ────────────────────────────────────
  { type: 'notion_token',      regex: /secret_[A-Za-z0-9]{43,}/,                                severity: 'HIGH' },
  { type: 'airtable_key',      regex: /(?:key|pat)[A-Za-z0-9]{14,}\.[A-Za-z0-9]{16,}/,          severity: 'MEDIUM' },

  // ── Supabase / PlanetScale / Neon / Upstash ──────────────
  { type: 'supabase_key',      regex: /eyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{10,}/, severity: 'HIGH' },
  { type: 'planetscale',       regex: /pscale_tkn_[A-Za-z0-9]{32,}/,                            severity: 'HIGH' },
  { type: 'neon_connection',   regex: /postgresql:\/\/[^:@]+:[^@]+@ep-/,                        severity: 'HIGH' },
  { type: 'upstash_redis',     regex: /rediss?:\/\/[^:@]+:[^@]+@[a-z0-9-]+\.upstash\.io/,       severity: 'HIGH' },

  // ── Vercel / Netlify / Heroku ────────────────────────────
  { type: 'vercel_token',      regex: /[A-Za-z0-9]{24}\.[A-Za-z0-9]{24}\.[A-Za-z0-9]{16}/,     severity: 'MEDIUM' },
  { type: 'netlify_token',     regex: /nfp_[A-Za-z0-9]{50,}/,                                   severity: 'HIGH' },
  { type: 'heroku_api',        regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, severity: 'MEDIUM' },

  // ── npm ──────────────────────────────────────────────────
  { type: 'npm_token',         regex: /npm_[A-Za-z0-9]{36,}/,                                    severity: 'HIGH' },

  // ── Private Keys ─────────────────────────────────────────
  { type: 'rsa_private',       regex: /-----BEGIN RSA PRIVATE KEY-----/,                         severity: 'HIGH' },
  { type: 'ec_private',        regex: /-----BEGIN EC PRIVATE KEY-----/,                          severity: 'HIGH' },
  { type: 'dsa_private',       regex: /-----BEGIN DSA PRIVATE KEY-----/,                         severity: 'HIGH' },
  { type: 'openssh_private',   regex: /-----BEGIN OPENSSH PRIVATE KEY-----/,                     severity: 'HIGH' },
  { type: 'pgp_private',       regex: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,                   severity: 'HIGH' },

  // ── Database Connection Strings ──────────────────────────
  { type: 'mongo_connection',  regex: /mongodb(?:\+srv)?:\/\/[^:@]+:[^@]+@/,                     severity: 'HIGH' },
  { type: 'mysql_connection',  regex: /mysql:\/\/[^:@]+:[^@]+@/,                                 severity: 'HIGH' },
  { type: 'pg_connection',     regex: /postgres(?:ql)?:\/\/[^:@]+:[^@]+@/,                       severity: 'HIGH' },
  { type: 'redis_connection',  regex: /redis:\/\/[^:@]+:[^@]+@/,                                 severity: 'HIGH' },

  // ── Generic / API Keys ───────────────────────────────────
  { type: 'api_key_header',    regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([A-Za-z0-9_\-]{20,})['"]?/i, severity: 'MEDIUM' },
  { type: 'bearer_token',      regex: /(?:token|auth|bearer)\s*[:=]\s*['"]?([A-Za-z0-9_\-.]{20,})['"]?/i, severity: 'MEDIUM' },
  { type: 'password_assign',   regex: /(?:password|passwd|pwd)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/i, severity: 'MEDIUM' },
  { type: 'jwt_token',         regex: /eyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{10,}/, severity: 'HIGH' },
  { type: 'base64_large',      regex: /(?:[A-Za-z0-9+/]{60,}={0,2})/,                            severity: 'MEDIUM' },
];

export class SecretScanner {
  scan(server: McpServerConfig): SecretFinding[] {
    const findings: SecretFinding[] = [];
    const seen = new Set<string>();

    if (server.env) {
      for (const [key, value] of Object.entries(server.env)) {
        if (typeof value !== 'string') continue;
        for (const pat of PATTERNS) {
          if (pat.regex.test(value)) {
            const id = `${pat.type}:${key}`;
            if (seen.has(id)) continue;
            seen.add(id);
            findings.push({ type: pat.type, location: `env:${key}`, severity: pat.severity });
          }
        }
      }
    }

    if (server.args && server.args.length > 0) {
      const cmdline = server.args.join(' ');
      for (const pat of PATTERNS) {
        if (pat.regex.test(cmdline)) {
          const id = `${pat.type}:command_args`;
          if (seen.has(id)) continue;
          seen.add(id);
          findings.push({ type: pat.type, location: 'command_args', severity: pat.severity === 'HIGH' ? 'HIGH' : 'MEDIUM' });
        }
      }
    }

    return findings;
  }
}