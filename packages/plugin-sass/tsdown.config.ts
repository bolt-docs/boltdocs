import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/node/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['vite', 'boltdocs', 'sass-embedded', 'sass'],
})
