import { defineConfig, licenseBanner, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
    entry: { index: 'src/index.ts', vite: 'src/vite.ts' },
    format: ['esm'],
    dts: true,
    clean: true,
    outputOptions: { comments: { jsdoc: false } },
    minify: true,
    banner: { js: licenseBanner },
    tsconfig: './tsconfig.json',
    deps: { neverBundle: ['react', 'react-dom', 'vite'] },
  }),
)
