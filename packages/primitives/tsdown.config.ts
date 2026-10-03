import { defineConfig, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    tsconfig: './tsconfig.json',
    deps: {
      neverBundle: ['react', 'react-dom'],
    },
  }),
)
