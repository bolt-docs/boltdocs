import { defineConfig } from 'tsdown'

const banner = `/**
 * Boltdocs - https://boltdocs.vercel.app
 * Copyright (c) 2026 Jesus Alcala
 * Licensed under the MIT License.
 */`

export default defineConfig({
  entry: {
    'node/index': 'src/node/index.ts',
    'client/index': 'src/client/index.ts',
  },
  format: ['esm'],
  banner: {
    js: banner,
    css: banner,
  },
  dts: true,
  clean: true,
  tsconfig: './tsconfig.json',
  deps: {
    neverBundle: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'katex',
      'boltdocs',
      'boltdocs/client',
      '@bdocs/dui',
    ],
  },
})
