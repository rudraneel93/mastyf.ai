#!/usr/bin/env node
/**
 * Rewrite workspace: deps to semver for npm pack/publish tarballs.
 * Restored by postpack-npm-deps.mjs.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT_PKG = 'package.json';
const BACKUP = '.package.prepack-backup.json';

const pkg = JSON.parse(readFileSync(ROOT_PKG, 'utf8'));
writeFileSync(BACKUP, readFileSync(ROOT_PKG, 'utf8'));

const dep = pkg.dependencies?.['@mcp-guardian/plugin-sdk'];
if (typeof dep === 'string' && dep.startsWith('workspace:')) {
  pkg.dependencies['@mcp-guardian/plugin-sdk'] = '^3.0.0';
  writeFileSync(ROOT_PKG, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('[prepack] @mcp-guardian/plugin-sdk → ^3.0.0 for npm tarball');
}
