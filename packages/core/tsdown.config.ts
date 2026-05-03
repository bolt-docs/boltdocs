import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'tsdown'

const banner = `/**
 * Boltdocs - https://boltdocs.vercel.app
 * Copyright (c) 2026 Jesus Alcala
 * Licensed under the MIT License.
 */`

export default defineConfig([
  // Node Build
  {
    entry: {
      'node/index': 'src/node/index.ts',
      'node/cli-entry': 'src/node/cli-entry.ts',
      'node/routes/worker': 'src/node/routes/worker.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    tsconfig: './tsconfig.json',
    minify: true,
    platform: 'node',
    shims: true,
    clean: true,
    banner: {
      js: banner,
      css: banner,
    },
    deps: {
      skipNodeModulesBundle: true,
      neverBundle: [
        'virtual:boltdocs-routes',
        'virtual:boltdocs-routes.ts',
        'virtual:boltdocs-config',
        'virtual:boltdocs-config.ts',
        'virtual:boltdocs-layout',
        'virtual:boltdocs-layout.tsx',
        'virtual:boltdocs-mdx-components',
        'virtual:boltdocs-mdx-components.tsx',
        'virtual:boltdocs-entry',
        'virtual:boltdocs-entry.tsx',
        'virtual:boltdocs-search',
        'virtual:boltdocs-search.ts',
      ],
    },
    async onSuccess() {
      const src = path.resolve(__dirname, 'src/client/theme/neutral.css')
      const destDir = path.resolve(__dirname, 'dist/client/theme')
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }
      fs.copyFileSync(src, path.resolve(destDir, 'neutral.css'))
      console.log('✓ Theme neutral.css copied to dist')
    },
  },
  // Client Build
  {
    entry: {
      'client/index': 'src/client/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    tsconfig: './tsconfig.json',
    minify: true,
    platform: 'browser',
    shims: true,
    clean: false,
    banner: {
      js: banner,
      css: banner,
    },
    deps: {
      skipNodeModulesBundle: true,
      neverBundle: [
        'react',
        'react-dom',
        'react-router-dom',
        'virtual:boltdocs-routes',
        'virtual:boltdocs-routes.ts',
        'virtual:boltdocs-config',
        'virtual:boltdocs-config.ts',
        'virtual:boltdocs-layout',
        'virtual:boltdocs-layout.tsx',
        'virtual:boltdocs-mdx-components',
        'virtual:boltdocs-mdx-components.tsx',
        'virtual:boltdocs-entry',
        'virtual:boltdocs-entry.tsx',
        'virtual:boltdocs-search',
        'virtual:boltdocs-search.ts',
      ],
    },
  },
])
