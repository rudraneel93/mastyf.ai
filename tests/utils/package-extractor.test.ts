import { describe, it, expect } from 'vitest';
import { extractPackagesFromServer } from '../../src/utils/package-extractor.js';

describe('extractPackagesFromServer', () => {
  it('extracts scoped npm package from npx args', () => {
    const pkgs = extractPackagesFromServer({
      command: 'npx',
      args: ['-y', '@modelcontextprotool/server-filesystem', '/tmp'],
    });
    expect(pkgs).toContain('@modelcontextprotool/server-filesystem');
  });

  it('extracts official filesystem package', () => {
    const pkgs = extractPackagesFromServer({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/data'],
    });
    expect(pkgs).toContain('@modelcontextprotocol/server-filesystem');
  });
});
