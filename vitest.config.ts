import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    maxConcurrency: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/cli.ts'],
    },
  },
});
