import { defineConfig } from 'tsdown'

const banner = `/**
 * @bdocs/unist-utils - https://boltdocs.vercel.app
 * Copyright (c) 2026 Jesus Alcala
 * Licensed under the MIT License.
 */`

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  banner: {
    js: banner,
  },
  dts: true,
  clean: true,
  tsconfig: './tsconfig.json',
})
