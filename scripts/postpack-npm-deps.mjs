#!/usr/bin/env node
/** Restore package.json after prepack-npm-deps.mjs */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

const ROOT_PKG = 'package.json';
const BACKUP = '.package.prepack-backup.json';

if (existsSync(BACKUP)) {
  writeFileSync(ROOT_PKG, readFileSync(BACKUP, 'utf8'));
  unlinkSync(BACKUP);
  console.log('[postpack] restored package.json workspace deps');
}
