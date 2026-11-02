import { defineConfig, packageConfig } from 'tsdown-config'

const banner = `/**
 * Boltdocs - https://boltdocs.vercel.app
 * Copyright (c) 2026 Jesus Alcala
 * Licensed under the MIT License.
 */`

export default defineConfig([
  packageConfig({
    entry: {
      'node/index': 'src/node/index.ts',
    },
    format: ['esm'],
    dts: true,
    tsconfig: './tsconfig.json',
    minify: true,
    platform: 'node',
    shims: true,
    clean: true,
    banner: { js: banner },
    deps: {
      skipNodeModulesBundle: true,
      neverBundle: [
        'virtual:boltdocs-routes',
        'virtual:boltdocs-routes.ts',
        'virtual:boltdocs-search',
        'virtual:boltdocs-search.ts',
      ],
    },
  }),
])
