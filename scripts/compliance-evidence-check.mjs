#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';

const requiredFiles = [
  'docs/COMPLIANCE.md',
  'docs/ENTERPRISE_DEPLOYMENT.md',
  'README.md',
];

const requiredPhrases = [
  { file: 'docs/COMPLIANCE.md', phrase: 'Policy integrity and provenance' },
  { file: 'docs/COMPLIANCE.md', phrase: 'Dual-control policy governance' },
  { file: 'docs/ENTERPRISE_DEPLOYMENT.md', phrase: 'Signed policy governance' },
  { file: 'docs/ENTERPRISE_DEPLOYMENT.md', phrase: 'Four-eyes policy updates' },
];

const missing = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) missing.push(`missing file: ${file}`);
}

for (const check of requiredPhrases) {
  if (!existsSync(check.file)) continue;
  const text = readFileSync(check.file, 'utf-8');
  if (!text.includes(check.phrase)) {
    missing.push(`missing phrase '${check.phrase}' in ${check.file}`);
  }
}

if (missing.length) {
  console.error('[compliance-evidence-check] FAILED');
  for (const issue of missing) console.error(` - ${issue}`);
  process.exit(1);
}

console.log('[compliance-evidence-check] OK');
