import { normalizePath } from '../utils'
import type { BoltdocsConfig } from '../config'
import type { BoltdocsPluginOptions } from './types'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Check if the combined pages file (written by Sätteri pre-compilation)
 * exists and read the glob map.
 */
function getCombinedPagesInfo(root: string): {
  pagesPath: string
  globMap: Record<string, string>
} | null {
  const compiledDir = path.join(root, '.boltdocs', 'compiled')
  const pagesFile = path.join(compiledDir, 'pages', 'index.mjs')
  const globMapFile = path.join(compiledDir, 'pages-glob-map.json')

  if (fs.existsSync(pagesFile) && fs.existsSync(globMapFile)) {
    try {
      const globMap = JSON.parse(
        fs.readFileSync(globMapFile, 'utf-8'),
      ) as Record<string, string>
      return { pagesPath: pagesFile, globMap }
    } catch {
      return null
    }
  }
  return null
}

/**
 * Generates the raw source code for the virtual entry file (`\0virtual:boltdocs-entry`).
 * This code initializes the client-side React application.
 *
 * @param options - Plugin options containing potential custom overrides (like `homePage` or `customCss`)
 * @param config - The resolved Boltdocs configuration containing custom plugins and components
 * @returns A string of JavaScript code to be evaluated by the browser
 */
export function generateEntryCode(
  options: BoltdocsPluginOptions,
  config?: BoltdocsConfig,
): string {
  // Auto-import index.css if it exists
  const cssPath = path.resolve(process.cwd(), 'index.css')
  const cssImport = fs.existsSync(cssPath) ? "import './index.css';" : ''

  const pluginComponents =
    config?.plugins?.flatMap((p) => Object.entries(p.components || {})) || []

  const componentImports = pluginComponents
    .map(
      ([name, compPath]) =>
        `import { ${name} as _comp_${name} } from '${normalizePath(compPath)}';`,
    )
    .join('\n')
  const pluginComponentMap = pluginComponents
    .map(([name]) => `${name}: _comp_${name}`)
    .join(', ')
  const componentMap = pluginComponentMap

  const docsDirName = path.basename(options.docsDir || 'docs')
  const docsDir = path.resolve(process.cwd(), options.docsDir || 'docs')

  // Detect external pages module
  const externalModulePath = ['tsx', 'ts', 'jsx', 'js']
    .map((ext) => path.resolve(docsDir, `pages-external/index.${ext}`))
    .find((p) => fs.existsSync(p))

  const externalModuleImport = externalModulePath
    ? `import * as _external_module from '${normalizePath(externalModulePath)}';`
    : ''

  const externalOption = externalModulePath
    ? 'externalPages: _external_module.pages, externalLayout: _external_module.layout,'
    : ''

  // SSR builds: use combined pages file (1 module instead of 202)
  // Client builds: use lazy import.meta.glob for code splitting
  const isSSR = process.env.VITE_SSG === 'true'

  // Background prefetch: after first paint, load all MDX modules in batches
  // so navigation is instant (modules already in Vite/browser cache).
  const prefetchCode = isSSR
    ? ''
    : [
        "if (typeof window !== 'undefined' && import.meta.env.PROD) {",
        '  const prefetchAll = () => {',
        '    const getters = Object.values(mdxModules)',
        '    if (getters.length === 0) return',
        '    let i = 0',
        '    const nextBatch = () => {',
        '      if (i >= getters.length) return',
        '      const batch = getters.slice(i, i + 6)',
        '      i += batch.length',
        '      Promise.allSettled(batch.map(fn => fn())).then(() => {',
        '        setTimeout(nextBatch, 0)',
        '      })',
        '    }',
        "    ;(typeof requestIdleCallback === 'function' ? requestIdleCallback : function(cb) { setTimeout(cb, 500) })(nextBatch)",
        '  }',
        '  prefetchAll()',
        '}',
      ].join('\n')

  const layoutGlob = `/${docsDirName}/**/layout.tsx`
  const listGlob = `/${docsDirName}/**/list.tsx`
  const postGlob = `/${docsDirName}/**/post.tsx`

  // P2-20: Check if client chunk packs exist.  Always prefer chunks over
  // individual imports — reduces Vite/Rolldown module count from N to K.
  function getChunkMap(): Record<string, number> | null {
    const cmPath = path.join(
      process.cwd(),
      '.boltdocs',
      'compiled',
      'pages-chunk-map.json',
    )
    try {
      if (fs.existsSync(cmPath)) {
        return JSON.parse(fs.readFileSync(cmPath, 'utf-8'))
      }
    } catch {}
    return null
  }

  // Check for pre-compiled pages written by the Sätteri plugin buildStart().
  // In dev, buildStart() does not write these files, so this safely falls
  // back to import.meta.glob. In production, both client and SSR builds
  // should use the pre-compiled files.
  const combinedInfo = getCombinedPagesInfo(process.cwd())

  let mdxModulesCode: string

  if (combinedInfo) {
    // Use pre-compiled individual pages for both client and SSR builds.
    // - SSR uses eager static imports because renderToString is synchronous.
    // - Client uses dynamic imports to keep code-splitting / lazy loading.
    const { globMap } = combinedInfo
    const globKeys = Object.keys(globMap)

    if (isSSR) {
      // PR-06: Use combined.mjs (1 module instead of N individual files).
      // The combined file is written by the Sätteri plugin during
      // runPreCompile() and contains all pages in a single import.
      const combinedFullPath = path.join(
        process.cwd(),
        '.boltdocs',
        'compiled',
        'pages',
        'combined.mjs',
      )

      if (fs.existsSync(combinedFullPath) && globKeys.length > 0) {
        // P2-30.2: Use dynamic import instead of static import for combined.mjs.
        // This tells Rolldown to emit combined.mjs as a SEPARATE chunk instead
        // of bundling all 202+ pages' code into the SSR entry.  The SSR entry
        // shrinks from ~7MB to ~500KB, reducing SSR build time by 3-5s.
        // Top-level await in ESM is valid and supported by Rolldown.
        // The `|| __mdx_pages` fallback handles both default-only and
        // mixed named/default export patterns from combined.mjs.
        mdxModulesCode = [
          `const __mdx_pages = await import('/.boltdocs/compiled/pages/combined.mjs');`,
          'const mdxModules = __mdx_pages.default || __mdx_pages;',
        ].join('\n')
      } else {
        // Fallback: individual imports (first build or combined file not yet written)
        const importLines = globKeys.map(
          (key) =>
            `import * as ${globMap[key]} from '/.boltdocs/compiled/pages/${globMap[key]}.mjs';`,
        )
        const entries = globKeys.map(
          (key) => `  '${key}': { default: ${globMap[key]}.default }`,
        )
        mdxModulesCode = [
          ...importLines,
          'const mdxModules = {',
          entries.join(','),
          '};',
        ].join('\n')
      }
    } else {
      // P2-20: Always prefer chunk packs when available (reduces Vite/Rolldown
      // module count from N to K).  Falls back to individual imports for small
      // sites (≤25 pages) or when chunk map doesn't exist (first build).
      const chunkMap = getChunkMap()
      if (chunkMap && Object.keys(chunkMap).length > 0) {
        const entries = globKeys.map((key) => {
          const chunkIdx = chunkMap[key]
          if (chunkIdx !== undefined) {
            return `  '${key}': () => import('/.boltdocs/compiled/pages/chunk-${chunkIdx}.mjs').then(m => m.default['${key}'])`
          }
          // Fallback: page not in chunk map (shouldn't happen)
          return `  '${key}': () => import('/.boltdocs/compiled/pages/${globMap[key]}.mjs')`
        })
        mdxModulesCode = ['const mdxModules = {', entries.join(','), '};'].join(
          '\n',
        )
      } else {
        const entries = globKeys.map(
          (key) =>
            `  '${key}': () => import('/.boltdocs/compiled/pages/${globMap[key]}.mjs')`,
        )
        mdxModulesCode = ['const mdxModules = {', entries.join(','), '};'].join(
          '\n',
        )
      }
    }
  } else {
    // Client build or no combined file available — use import.meta.glob
    const globMode = isSSR ? '{ eager: true }' : '{}'
    mdxModulesCode = `const mdxModules = import.meta.glob('/${docsDirName}/**/*.{md,mdx}', ${globMode});`
  }

  const lines = [
    `import { ViteReactSSG, createRoutes } from 'boltdocs/client'`,
    `import _routes from 'virtual:boltdocs-routes.ts'`,
    `import _collections from 'virtual:boltdocs-collections.ts'`,
    `import _config from 'virtual:boltdocs-config.ts'`,
    `import _user_mdx_components from 'virtual:boltdocs-mdx-components.tsx'`,
    cssImport,
    componentImports,
    externalModuleImport,
    '',
    mdxModulesCode,
    '',
    `const _collLayoutMods = import.meta.glob('${layoutGlob}', { eager: true });`,
    `const _collListMods = import.meta.glob('${listGlob}', { eager: true });`,
    `const _collPostMods = import.meta.glob('${postGlob}', { eager: true });`,
    '',
    `const _collectionLayouts = {};`,
    `for (const [p, mod] of Object.entries(_collLayoutMods)) {`,
    `  const dir = p.split('/').slice(-2, -1)[0];`,
    `  if (dir.startsWith('[') && dir.endsWith(']')) {`,
    `    _collectionLayouts[dir.slice(1, -1)] = mod.default || mod;`,
    `  }`,
    `}`,
    '',
    `const _collectionLists = {};`,
    `for (const [p, mod] of Object.entries(_collListMods)) {`,
    `  const dir = p.split('/').slice(-2, -1)[0];`,
    `  if (dir.startsWith('[') && dir.endsWith(']')) {`,
    `    _collectionLists[dir.slice(1, -1)] = mod.default || mod;`,
    `  }`,
    `}`,
    '',
    `const _collectionPosts = {};`,
    `for (const [p, mod] of Object.entries(_collPostMods)) {`,
    `  const dir = p.split('/').slice(-2, -1)[0];`,
    `  if (dir.startsWith('[') && dir.endsWith(']')) {`,
    `    _collectionPosts[dir.slice(1, -1)] = mod.default || mod;`,
    `  }`,
    `}`,
    '',
    `export const createRoot = ViteReactSSG(`,
    `  {`,
    `    routes: createRoutes({`,
    `      routesData: _routes,`,
    `      collectionsData: _collections,`,
    `      collectionLayouts: _collectionLayouts,`,
    `      collectionLists: _collectionLists,`,
    `      collectionPosts: _collectionPosts,`,
    `      config: _config,`,
    `      mdxModules,`,
    `      ${externalOption}`,
    `      components: { ${componentMap}${componentMap ? ', ' : ''} ...(_user_mdx_components || {}) },`,
    `    }),`,
    `  },`,
    `  ({ isClient }) => {`,
    `    // Boltdocs initialization hook`,
    `    if (isClient) {`,
    `      // Client-side initialization`,
    `    }`,
    `  },`,
    `);`,
    prefetchCode,
  ]

  return lines.filter(Boolean).join('\n') + '\n'
}
