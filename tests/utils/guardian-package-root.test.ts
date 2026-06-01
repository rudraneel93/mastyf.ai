import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveGuardianInstallRoot,
  resetGuardianInstallRootCache,
} from '../../src/utils/guardian-package-root.js';

describe('resolveGuardianInstallRoot', () => {
  afterEach(() => {
    resetGuardianInstallRootCache();
  });

  it('resolves repo root with dist/cli.js when running from vitest', () => {
    const root = resolveGuardianInstallRoot();
    expect(existsSync(join(root, 'package.json'))).toBe(true);
    expect(existsSync(join(root, 'dist', 'cli.js'))).toBe(true);
  });
});
