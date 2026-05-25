/**
 * Guardian Autopilot — single env preset for plug-and-play operation.
 */
import { readAutopilotConfig, type AutopilotConfig } from './autopilot-config.js';

const AUTOPILOT_ENV: Record<string, string> = {
  GUARDIAN_AUTOPILOT: 'true',
  DASHBOARD_ENABLED: 'true',
  GUARDIAN_WS_ENABLED: 'true',
  GUARDIAN_THREAT_RESEARCH_AUTO: 'true',
  SWARM_THREAT_RESEARCH_AUTO: 'true',
  GUARDIAN_THREAT_DISCOVERY_AUTOSTART: 'true',
  GUARDIAN_AI_ENABLED: 'true',
  GUARDIAN_SEMANTIC_ASYNC: 'true',
  GUARDIAN_AI_AUTO_APPLY: 'false',
  GUARDIAN_AUTO_CORPUS_PROMOTE: 'false',
  GUARDIAN_DASHBOARD_STRICT_LIVE: 'true',
  GUARDIAN_REPORT_SCHEDULE: 'daily',
};

export function isAutopilotMode(): boolean {
  return process.env.GUARDIAN_AUTOPILOT === 'true' || readAutopilotConfig()?.enabled === true;
}

/** Apply Autopilot env defaults (does not override explicitly set vars). */
export function applyAutopilotEnv(config?: AutopilotConfig | null): void {
  const cfg = config ?? readAutopilotConfig();
  const schedule = cfg?.reportSchedule ?? 'daily';
  const hour = cfg?.reportCronHour ?? 6;

  for (const [key, value] of Object.entries(AUTOPILOT_ENV)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  if (process.env.GUARDIAN_REPORT_SCHEDULE === undefined) {
    process.env.GUARDIAN_REPORT_SCHEDULE = schedule === 'off' ? 'off' : schedule;
  }
  if (process.env.GUARDIAN_REPORT_CRON_HOUR === undefined) {
    process.env.GUARDIAN_REPORT_CRON_HOUR = String(hour);
  }
  if (cfg?.policyPath && process.env.GUARDIAN_POLICY_PATH === undefined) {
    process.env.GUARDIAN_POLICY_PATH = cfg.policyPath;
  }
  if (cfg?.corpusEvalGate && process.env.GUARDIAN_AUTOPILOT_CORPUS_GATE === undefined) {
    process.env.GUARDIAN_AUTOPILOT_CORPUS_GATE = 'true';
  }
}

/** Force Autopilot env (used by `autopilot start`). */
export function forceAutopilotEnv(config?: AutopilotConfig | null): void {
  const cfg = config ?? readAutopilotConfig();
  for (const [key, value] of Object.entries(AUTOPILOT_ENV)) {
    process.env[key] = value;
  }
  process.env.GUARDIAN_REPORT_SCHEDULE = cfg?.reportSchedule === 'off' ? 'off' : (cfg?.reportSchedule || 'daily');
  process.env.GUARDIAN_REPORT_CRON_HOUR = String(cfg?.reportCronHour ?? 6);
  if (cfg?.policyPath) process.env.GUARDIAN_POLICY_PATH = cfg.policyPath;
  if (cfg?.corpusEvalGate !== false) process.env.GUARDIAN_AUTOPILOT_CORPUS_GATE = 'true';
  process.env.GUARDIAN_AUTOPILOT = 'true';
}
