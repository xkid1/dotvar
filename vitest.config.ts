import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    // Exact-match regexes: a plain '@types' string alias would also capture '@types/node'.
    // Keep in sync with tsconfig.json "paths" and scripts/rewrite-aliases.mjs.
    alias: [
      { find: /^@libs$/, replacement: fromRoot('./src/libs/index.ts') },
      { find: /^@libs\/([\w-]+)$/, replacement: fromRoot('./src/libs/$1/index.ts') },
      { find: /^@utils$/, replacement: fromRoot('./src/utils/index.ts') },
      { find: /^@utils\/([\w-]+)$/, replacement: fromRoot('./src/utils/$1/index.ts') },
      { find: /^@types$/, replacement: fromRoot('./src/types/index.ts') },
    ],
  },
  test: {
    benchmark: {
      include: ['bench/**/*.bench.ts'],
    },
    include: ['src/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/*.test.ts', 'src/types/**', 'src/config.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
});
