import { defineConfig, packageConfig } from 'tsdown-config'

const banner = `/**\n * Boltdocs - https://boltdocs.vercel.app\n * Copyright (c) 2026 Jesus Alcala\n * Licensed under the MIT License.\n */`

export default defineConfig([
  packageConfig({
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    dts: true,
    tsconfig: './tsconfig.json',
    minify: true,
    platform: 'node',
    shims: false,
    clean: true,
    banner: { js: banner },
    deps: {
      skipNodeModulesBundle: true,
      neverBundle: [],
    },
  }),
])
