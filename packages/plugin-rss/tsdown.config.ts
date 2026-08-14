import { defineConfig, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
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
  }),
)
