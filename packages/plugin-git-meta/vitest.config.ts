import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'boltdocs/client': path.resolve(
        __dirname,
        'tests/mocks/boltdocs-client.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 20000,
  },
})
