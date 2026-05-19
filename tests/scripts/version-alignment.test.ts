import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function version(pkg: string): string {
  return JSON.parse(readFileSync(resolve(process.cwd(), pkg), 'utf-8')).version;
}

describe('version alignment', () => {
  it('core, server, cli match root package', () => {
    const root = version('package.json');
    expect(version('packages/core/package.json')).toBe(root);
    expect(version('packages/server/package.json')).toBe(root);
    expect(version('packages/cli/package.json')).toBe(root);
  });
});
