import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'node/index': 'src/node/index.ts',
    'node/compile-worker': 'src/node/compile-worker.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  tsconfig: './tsconfig.json',
  deps: {
    neverBundle: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'vite',
      'boltdocs',
      'boltdocs/client',
      'boltdocs/node/cache',
      'boltdocs/node/mdx/shiki-adapter',
      'satteri',
      'esbuild',
    ],
  },
})
