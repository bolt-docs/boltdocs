import { defineConfig, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    tsconfig: './tsconfig.json',
  }),
)
