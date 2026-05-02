import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'node/index': 'src/node/index.tsx',
    'client/index': 'src/client/index.tsx',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  tsconfig: './tsconfig.json',
  deps: {
    neverBundle: ['react', 'react-dom', 'react/jsx-runtime', 'vite', 'boltdocs', 'boltdocs/client'],
  },
})