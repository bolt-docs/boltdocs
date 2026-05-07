import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'node/index': 'src/node/index.ts',
    'client/index': 'src/client/index.ts',
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
