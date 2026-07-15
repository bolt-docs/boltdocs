import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'node/index': 'src/node/index.ts',
    'node/render-worker': 'src/node/render-worker.ts',
    'client/index': 'src/client/index.ts',
    'client/static': 'src/client/index-static.ts',
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
      'mermaid',
      'boltdocs',
      'boltdocs/client',
    ],
  },
})
