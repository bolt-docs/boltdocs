import { defineConfig, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
    entry: ['src/node/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    deps: {
      neverBundle: ['vite', 'boltdocs', 'unocss', '@unocss/vite'],
    },
  }),
)
