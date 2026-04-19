import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/contract/**/*.test.ts',
      'tests/compliance/**/*.test.ts',
    ],
    exclude: ['node_modules', '.next', 'origin', 'tests/e2e/**'],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/**', '.next/**', 'origin/**', 'tests/**', '*.config.*', 'scripts/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
