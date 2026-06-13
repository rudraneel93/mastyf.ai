import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveMastyfAiInstallRoot,
  resetMastyfAiInstallRootCache,
} from '../../src/utils/mastyf-ai-package-root.js';

describe('resolveMastyfAiInstallRoot', () => {
  afterEach(() => {
    resetMastyfAiInstallRootCache();
  });

  it('resolves repo root with dist/cli.js when running from vitest', () => {
    const root = resolveMastyfAiInstallRoot();
    expect(existsSync(join(root, 'package.json'))).toBe(true);
    expect(existsSync(join(root, 'dist', 'cli.js'))).toBe(true);
  });
});
