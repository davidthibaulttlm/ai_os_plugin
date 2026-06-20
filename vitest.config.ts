import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/test/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'webview-ui', '**/*.stories.*'],
    alias: {
      vscode: resolve(__dirname, './src/test/mocks/vscode.ts'),
    },
    coverage: {
      provider: 'v8',
      include: ['src/services/**/*.ts'],
      exclude: [
        'src/services/graphql.js',
        'src/services/logger.ts',
        'src/services/stateBridge.ts',
      ],
      // Per-change 90% target enforced in CI on new/modified files only.
      // Global threshold disabled — overall project coverage grows incrementally.
    },
  },
});
