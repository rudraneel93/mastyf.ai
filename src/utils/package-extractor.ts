import type { McpServerConfig } from '../types.js';

const SCOPED_NPM = /@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*/gi;
const BARE_NPM = /^[a-z0-9][a-z0-9._-]*$/i;

/**
 * Extract npm/PyPI package identifiers from MCP server command lines.
 */
export function extractPackagesFromServer(
  server: Pick<McpServerConfig, 'command' | 'args' | 'packageName'>,
): string[] {
  const found = new Set<string>();
  if (server.packageName?.trim()) found.add(server.packageName.trim());

  const command = (server.command ?? '').trim().toLowerCase();
  const args = server.args ?? [];

  for (const arg of args) {
    if (!arg || arg.startsWith('-')) continue;
    for (const match of arg.matchAll(SCOPED_NPM)) {
      found.add(match[0]);
    }
    if (arg.startsWith('@') && arg.includes('/')) found.add(arg);
  }

  if (command === 'npx' || command.endsWith('/npx')) {
    for (const arg of args) {
      if (arg.startsWith('-')) continue;
      if (arg.startsWith('@') && arg.includes('/')) found.add(arg);
      else if (BARE_NPM.test(arg)) found.add(arg);
    }
  }

  if (command === 'uvx' || command === 'uv' || command.includes('python')) {
    for (const arg of args) {
      if (!arg.startsWith('-') && !arg.includes('/') && arg.length > 1) found.add(arg);
    }
  }

  return [...found];
}
