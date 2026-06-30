import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'node/index': 'src/node/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  tsconfig: './tsconfig.json',
  deps: {
    neverBundle: ['boltdocs'],
  },
})
