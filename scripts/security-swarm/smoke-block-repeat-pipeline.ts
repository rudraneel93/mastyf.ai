#!/usr/bin/env npx tsx
import { processThreatResearchEvent, buildBlockRepeatEvent } from '../../src/ai/threat-research-pipeline.js';

const event = buildBlockRepeatEvent(
  'sensitive-path',
  'read_file',
  'Blocked path /home/user/.ssh/config',
  `runtime-fp-${Date.now()}`,
  {
    arguments: { path: '/home/user/.ssh/config' },
    argSnippets: ['path=/home/user/.ssh/config'],
    windowBlocks: [
      {
        blockReason: 'Blocked path /etc/shadow',
        argsFingerprint: 'fp-shadow',
        argSnippets: ['path=/etc/shadow'],
        arguments: { path: '/etc/shadow' },
      },
    ],
  },
);

const result = await processThreatResearchEvent(event);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
