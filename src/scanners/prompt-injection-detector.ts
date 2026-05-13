export interface InjectionFinding {
  severity:    'critical' | 'high' | 'medium';
  patternId:   string;
  description: string;
  matchPreview: string;
}

interface InjectionPattern {
  id:          string;
  severity:    'critical' | 'high' | 'medium';
  description: string;
  regex:       string;  // stored as string, compiled at runtime
}

const INJECTION_RULES: InjectionPattern[] = [
  {
    id: 'role-override',
    severity: 'critical',
    description: 'Role/persona override attempt',
    regex: '(?:you are now|act as|pretend (?:to be|you are)|your new (?:role|persona|identity) is)',
  },
  {
    id: 'ignore-instructions',
    severity: 'critical',
    description: 'Instruction suppression attempt',
    regex: '(?:ignore (?:all |previous |your |the )?(?:instructions|rules|guidelines|system prompt)|disregard (?:everything|all))',
  },
  {
    id: 'developer-mode',
    severity: 'critical',
    description: 'DAN/developer mode jailbreak attempt',
    regex: '(?:developer mode|DAN mode|jailbreak|bypass (?:safety|filter|restriction|guardrail))',
  },
  {
    id: 'exfiltration-url',
    severity: 'critical',
    description: 'Data exfiltration via URL injection',
    regex: '(?:fetch|get|post|send|transmit|upload).{0,40}(?:https?:\\/\\/(?!(?:api\\.osv\\.dev|nvd\\.nist\\.gov))[\\w.-]+\\.[a-z]{2,})',
  },
  {
    id: 'exfiltration-instruction',
    severity: 'critical',
    description: 'Explicit exfiltration instruction in tool result',
    regex: '(?:send (?:this|the|all|your) (?:conversation|data|context|history|credentials?|tokens?|keys?) to)',
  },
  {
    id: 'new-goal-assignment',
    severity: 'high',
    description: 'New goal/objective injection',
    regex: '(?:your (?:new |primary |real |actual )?(?:goal|task|objective|mission|purpose) is|from now on[, ]+you (?:must|will|should))',
  },
  {
    id: 'system-prompt-override',
    severity: 'high',
    description: 'System prompt override attempt',
    regex: '(?:\\[system\\]|\\[system prompt\\]|<system>|system:\\s*\\n)',
  },
  {
    id: 'tool-chain-abuse',
    severity: 'high',
    description: 'Instruction to call specific tools or commands',
    regex: '(?:call the|use the|invoke|execute|run) (?:tool|command|function) (?:named |called |")?(?:bash|exec|eval|execute_command|shell|run_command)',
  },
  {
    id: 'credential-harvesting',
    severity: 'high',
    description: 'Request for credentials or sensitive data',
    regex: '(?:provide|share|give|output|print|return|send) (?:your |the |all )(?:api keys?|tokens?|passwords?|credentials?|secrets?|environment variables?)',
  },
  {
    id: 'unicode-homoglyph',
    severity: 'medium',
    description: 'Unicode homoglyph / invisible character injection',
    regex: '[\\u200B-\\u200F\\u00AD\\uFEFF\\u202A-\\u202E\\u2060-\\u2064]',
  },
];

// Lazy-compiled patterns
let compiledPatterns: Array<{ id: string; severity: 'critical' | 'high' | 'medium'; description: string; regex: RegExp }> | null = null;

function getPatterns(): Array<{ id: string; severity: 'critical' | 'high' | 'medium'; description: string; regex: RegExp }> {
  if (!compiledPatterns) {
    compiledPatterns = INJECTION_RULES.map(r => ({
      id: r.id,
      severity: r.severity,
      description: r.description,
      regex: new RegExp(r.regex, 'i'),
    }));
  }
  return compiledPatterns;
}

export function detectPromptInjection(
  toolName: string,
  responseBody: string,
): InjectionFinding[] {
  const findings: InjectionFinding[] = [];

  for (const pattern of getPatterns()) {
    const match = pattern.regex.exec(responseBody);
    if (!match) continue;

    const start   = Math.max(0, match.index - 20);
    const end     = Math.min(responseBody.length, match.index + match[0].length + 20);
    const preview = responseBody.slice(start, end).replace(/\n/g, ' ');

    findings.push({
      severity:     pattern.severity,
      patternId:    pattern.id,
      description:  pattern.description,
      matchPreview: `...${preview.slice(0, 80)}...`,
    });
  }

  return findings;
}