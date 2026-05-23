#!/usr/bin/env node
/** Regenerate lib/default-policy-embedded.ts from seeds/default-policy.yaml */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const yaml = readFileSync(join(root, 'seeds/default-policy.yaml'), 'utf8');
const escaped = yaml
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const out = `/** Auto-generated from seeds/default-policy.yaml — run: pnpm sync:default-policy */\nexport const DEFAULT_POLICY_YAML = \`${escaped}\`;\n`;
writeFileSync(join(root, 'lib/default-policy-embedded.ts'), out);
console.log('Wrote lib/default-policy-embedded.ts');
