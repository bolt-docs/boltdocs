import { defineConfig, packageConfig } from 'tsdown-config'

export default defineConfig(packageConfig({
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
}))
