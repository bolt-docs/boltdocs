import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: [
      'tests/integration/**',
      'tests/mdx/frontmatter-rendering.test.ts',
    ],
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'virtual:boltdocs-search': path.resolve(
        __dirname,
        './tests/mocks/virtual-search.ts',
      ),
      'virtual:boltdocs-mdx-components': path.resolve(
        __dirname,
        './tests/mocks/virtual-mdx-components.ts',
      ),
      'virtual:boltdocs-icons': path.resolve(
        __dirname,
        './tests/mocks/virtual-icons.ts',
      ),
      'virtual:boltdocs-layout': path.resolve(
        __dirname,
        './tests/mocks/virtual-layout.ts',
      ),
    },
  },
})
