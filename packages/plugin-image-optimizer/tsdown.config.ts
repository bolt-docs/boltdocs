import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    worker: 'src/worker.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  tsconfig: './tsconfig.json',
  platform: 'node',
  shims: true,
  deps: {
    neverBundle: ['vite', 'sharp', 'svgo', 'boltdocs', '@bdocs/dui'],
  },
})
