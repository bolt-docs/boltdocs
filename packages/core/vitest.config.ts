import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/mdx/frontmatter-rendering.test.ts'],
    environmentMatchGlobs: [['tests/integration/**', 'node']],
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The workspace packages resolve to their source, not their built
      // `dist`. A test that does `vi.mock('@bdocs/theme-neutral')` or mocks a
      // module the theme imports has to intercept the same module instance the
      // code under test uses, and a built bundle is a different one — it is
      // minified, split into chunks, and cannot be partially mocked at all.
      // Pointing at source is also what makes the boundary cheap to test rather
      // than something to work around.
      '@bdocs/theme-neutral': path.resolve(__dirname, '../theme-neutral/src'),
      '@bdocs/runtime': path.resolve(__dirname, '../runtime/src'),
      '@bdocs/primitives': path.resolve(__dirname, '../primitives/src'),
      '@bdocs/contracts': path.resolve(__dirname, '../contracts/src'),
      'virtual:boltdocs-search': path.resolve(
        __dirname,
        './tests/mocks/virtual-search.ts',
      ),
      'virtual:boltdocs-page-source': path.resolve(
        __dirname,
        './tests/mocks/virtual-page-source.ts',
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
      'virtual:boltdocs-client-registry': path.resolve(
        __dirname,
        './tests/mocks/virtual-client-registry.ts',
      ),
    },
  },
})
