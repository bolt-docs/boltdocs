import { defineConfig, packageConfig } from 'tsdown-config'

const banner = `/**
 * Boltdocs - https://boltdocs.vercel.app
 * Copyright (c) 2026 Jesus Alcala
 * Licensed under the MIT License.
 */`

export default defineConfig([
  // Node Build
  packageConfig({
    entry: {
      'node/index': 'src/node/index.ts',
      'node/cli-entry': 'src/node/cli-entry.ts',
      'node/cache': 'src/node/cache.ts',
      'node/highlight': 'src/node/highlight/index.ts',
      'node/mdx/shiki-adapter': 'src/node/mdx/shiki-adapter.ts',
      // Search is a registry, not an implementation: `@bdocs/plugin-search`
      // registers its generator here rather than the core depending on it,
      // which would be a cycle and would make search mandatory.
      'node/search/registry': 'src/node/search/registry.ts',
      'server/index': 'src/node/feedback/adapters/index.ts',
    },
    format: ['esm'],
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
  }),
  // The SSG bridge.
  //
  // The one client-shaped entry the engine still publishes: the component that
  // mounts the app, re-exported from `@bdocs/ssg` so a generated entry reaches
  // it through the package the site already depends on. The UI layer itself
  // lives in a theme package and is not here.
  packageConfig({
    entry: {
      'ssg/index': 'src/ssg.ts',
    },
    format: ['esm'],
    dts: true,
    tsconfig: './tsconfig.json',
    minify: false,
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
        'virtual:boltdocs-site-bridge',
        'virtual:boltdocs-site-bridge.ts',
      ],
    },
  }),
])
