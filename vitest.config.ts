import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    maxConcurrency: 1,
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/cli.ts', 'src/policy/shell-tokenizer.ts'],
      thresholds: {
        lines: 40,
        functions: 35,
        branches: 30,
        statements: 40,
      },
    },
  },
});
