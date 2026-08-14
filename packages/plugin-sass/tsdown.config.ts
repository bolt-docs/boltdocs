import { defineConfig, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
    entry: ['src/node/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    external: ['vite', 'boltdocs', 'sass-embedded', 'sass'],
  }),
)
