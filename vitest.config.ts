import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/a11y/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './packages/core/src'),
    },
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'json'],
    reportsDirectory: './coverage',
    include: ['packages/core/src/**/*.ts', 'packages/ssg/src/**/*.ts'],
    exclude: ['**/*.test.ts', '**/node_modules/**', '**/dist/**', '**/*.d.ts'],
  },
})
