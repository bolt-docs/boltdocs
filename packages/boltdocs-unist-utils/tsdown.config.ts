import { defineConfig, packageConfig } from 'tsdown-config'

const banner = `/**
 * @bdocs/unist-utils - https://boltdocs.vercel.app
 * Copyright (c) 2026 Jesus Alcala
 * Licensed under the MIT License.
 */`

export default defineConfig(
  packageConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    banner: {
      js: banner,
    },
    dts: true,
    clean: true,
    tsconfig: './tsconfig.json',
  }),
)
