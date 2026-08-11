import { normalizePath } from '../utils'
import type { BoltdocsConfig } from '../config'
import type { BoltdocsPluginOptions } from './types'
import path from 'node:path'
import fs from 'node:fs'
import { getExternalFileRoutes } from '../routes/pages-external'

/**
 * Check whether Sätteri produced a complete set of compiled page artifacts.
 */
function getCompiledPagesInfo(root: string): {
  globMap: Record<string, string>
  chunkMap: Record<string, number> | null
} | null {
  const compiledDir = path.join(root, '.boltdocs', 'compiled')
  const pagesDir = path.join(compiledDir, 'pages')
  const pagesFile = path.join(pagesDir, 'index.mjs')
  const globMapFile = path.join(compiledDir, 'pages-glob-map.json')
  const chunkMapFile = path.join(compiledDir, 'pages-chunk-map.json')

  if (!fs.existsSync(pagesFile) || !fs.existsSync(globMapFile)) return null

  try {
    const globMap = JSON.parse(fs.readFileSync(globMapFile, 'utf-8')) as Record<
      string,
      string
    >

    // Never use a partial or stale map. Falling back to Vite's source glob is
    // slower, but it is correct and avoids broken navigation after an
    // interrupted precompile or a deleted page.
    for (const exportName of Object.values(globMap)) {
      if (!/^[_A-Za-z0-9]+$/.test(exportName)) return null
      if (!fs.existsSync(path.join(pagesDir, `${exportName}.mjs`))) return null
    }

    let chunkMap: Record<string, number> | null = null
    if (fs.existsSync(chunkMapFile)) {
      chunkMap = JSON.parse(fs.readFileSync(chunkMapFile, 'utf-8')) as Record<
        string,
        number
      >
      for (const [key, index] of Object.entries(chunkMap)) {
        if (!Number.isInteger(index) || index < 0 || !globMap[key]) return null
        if (!fs.existsSync(path.join(pagesDir, `chunk-${index}.mjs`))) {
          return null
        }
      }
    }

    return { globMap, chunkMap }
  } catch {
    return null
  }
}

function compiledPagePath(root: string, fileName: string): string {
  return normalizePath(
    path.join(root, '.boltdocs', 'compiled', 'pages', fileName),
  )
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
  const projectRoot = path.resolve(options.root || process.cwd())

  // Auto-import index.css if it exists
  const cssPath = path.resolve(projectRoot, 'index.css')
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

  const docsDir = path.resolve(projectRoot, options.docsDir || 'docs')
  const docsDirGlob =
    normalizePath(path.relative(projectRoot, docsDir)).replace(/^\/+/, '') ||
    path.basename(docsDir)

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

  const externalFileRoutes = config?.experimental?.fileRouting
    ? getExternalFileRoutes(docsDir, config)
    : []
  const externalFileComponentRoutes = externalFileRoutes.filter(
    (route) => route.kind === 'component',
  )
  const externalFileMdxRoutes = externalFileRoutes.filter(
    (route) => route.kind === 'mdx',
  )
  const externalFileImports = externalFileComponentRoutes
    .map(
      (route, index) =>
        `import _external_file_${index} from ${JSON.stringify(normalizePath(route.filePath))};`,
    )
    .join('\n')
  const externalFileComponentMap = externalFileComponentRoutes.length
    ? `const _external_file_pages = {\n${externalFileComponentRoutes
        .map(
          (route, index) =>
            `  ${JSON.stringify(route.path)}: _external_file_${index},`,
        )
        .join('\n')}\n};`
    : 'const _external_file_pages = {};'
  const externalFileMdxMap = externalFileMdxRoutes.length
    ? `const _external_file_mdx = {\n${externalFileMdxRoutes
        .map((route) => {
          const sourcePath = normalizePath(
            path.relative(projectRoot, route.filePath),
          )
          return `  ${JSON.stringify(route.path)}: Object.entries(mdxModules).find(([key]) => key.endsWith(${JSON.stringify(sourcePath)}))?.[1],`
        })
        .join('\n')}\n};`
    : 'const _external_file_mdx = {};'

  // SSR builds: use combined pages file (1 module instead of 202)
  // Client builds: use lazy import.meta.glob for code splitting
  const isSSR = options.ssr === true

  // Keep page modules lazy until navigation. Prefetching every page during
  // idle time turns a code-split site into a full-site download and can
  // saturate bandwidth and the main thread on large documentation sites.
  const prefetchCode = ''

  const layoutGlob = `/${docsDirGlob}/**/layout.tsx`
  const listGlob = `/${docsDirGlob}/**/list.tsx`
  const postGlob = `/${docsDirGlob}/**/post.tsx`

  // Check for pre-compiled pages only when the caller explicitly opts in.
  // Vite dev/preview must use source MDX through import.meta.glob: compiled
  // disk artifacts are build output and may point at paths unavailable to the
  // browser or stale modules from a previous production build.
  const compiledPages = options.useCompiledPages
    ? getCompiledPagesInfo(projectRoot)
    : null

  let mdxModulesCode: string

  if (compiledPages) {
    // Use pre-compiled individual pages for both client and SSR builds.
    // - SSR uses the combined module to reduce the module graph.
    // - Client uses dynamic imports to keep code-splitting / lazy loading.
    const { globMap, chunkMap } = compiledPages
    // Sätteri may discover pages concurrently. Keep generated imports and
    // route-module object keys stable so cold builds produce the same client
    // chunk graph and content hashes.
    const globKeys = Object.keys(globMap).sort((left, right) =>
      left.localeCompare(right),
    )

    if (isSSR) {
      // Use combined.mjs (1 module instead of N individual files).
      // The combined file is written by the Sätteri plugin during
      // runPreCompile() and contains all pages in a single import.
      const combinedFullPath = compiledPagePath(projectRoot, 'combined.mjs')

      if (fs.existsSync(combinedFullPath) && globKeys.length > 0) {
        // Use dynamic import instead of static import for combined.mjs.
        // This tells Rolldown to emit combined.mjs as a SEPARATE chunk instead
        // of bundling all 202+ pages' code into the SSR entry.  The SSR entry
        // shrinks from ~7MB to ~500KB, reducing SSR build time by 3-5s.
        // Top-level await in ESM is valid and supported by Rolldown.
        // The `|| __mdx_pages` fallback handles both default-only and
        // mixed named/default export patterns from combined.mjs.
        mdxModulesCode = [
          `const __mdx_pages = await import(${JSON.stringify(compiledPagePath(projectRoot, 'combined.mjs'))});`,
          'const mdxModules = __mdx_pages.default || __mdx_pages;',
        ].join('\n')
      } else {
        // Fallback: individual imports (first build or combined file not yet written)
        const importLines = globKeys.map(
          (key) =>
            `import * as ${globMap[key]} from ${JSON.stringify(compiledPagePath(projectRoot, `${globMap[key]}.mjs`))};`,
        )
        const entries = globKeys.map(
          (key) =>
            `  ${JSON.stringify(key)}: { default: ${globMap[key]}.default }`,
        )
        mdxModulesCode = [
          ...importLines,
          'const mdxModules = {',
          entries.join(','),
          '};',
        ].join('\n')
      }
    } else {
      // Always prefer chunk packs when available (reduces Vite/Rolldown
      // module count from N to K).  Falls back to individual imports for small
      // sites (≤25 pages) or when chunk map doesn't exist (first build).
      if (chunkMap && Object.keys(chunkMap).length > 0) {
        const entries = globKeys.map((key) => {
          const chunkIdx = chunkMap[key]
          if (chunkIdx !== undefined) {
            return `  ${JSON.stringify(key)}: () => import(${JSON.stringify(compiledPagePath(projectRoot, `chunk-${chunkIdx}.mjs`))}).then(m => m.default[${JSON.stringify(key)}])`
          }
          // Fallback: page not in chunk map (shouldn't happen)
          return `  ${JSON.stringify(key)}: () => import(${JSON.stringify(compiledPagePath(projectRoot, `${globMap[key]}.mjs`))})`
        })
        mdxModulesCode = ['const mdxModules = {', entries.join(','), '};'].join(
          '\n',
        )
      } else {
        const entries = globKeys.map(
          (key) =>
            `  ${JSON.stringify(key)}: () => import(${JSON.stringify(compiledPagePath(projectRoot, `${globMap[key]}.mjs`))})`,
        )
        mdxModulesCode = ['const mdxModules = {', entries.join(','), '};'].join(
          '\n',
        )
      }
    }
  } else {
    // Client build or no combined file available — use import.meta.glob
    const globMode = isSSR ? '{ eager: true }' : '{}'
    mdxModulesCode = `const mdxModules = import.meta.glob('/${docsDirGlob}/**/*.{md,mdx}', ${globMode});`
  }

  const lines = [
    `import { ViteReactSSG, createRoutes, RouteRenderer, matchRouteBranch, matchRouteBranchWithParams, resolveRouteBranch } from 'boltdocs/client'`,
    `export { RouteRenderer, matchRouteBranch, matchRouteBranchWithParams, resolveRouteBranch }`,
    `import _routes from 'virtual:boltdocs-routes.ts'`,
    `import _collections from 'virtual:boltdocs-collections.ts'`,
    `import _config from 'virtual:boltdocs-config.ts'`,
    `import _user_mdx_components from 'virtual:boltdocs-mdx-components.tsx'`,
    cssImport,
    componentImports,
    externalModuleImport,
    externalFileImports,
    '',
    mdxModulesCode,
    externalFileComponentMap,
    externalFileMdxMap,
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
    `const createRoot = ViteReactSSG(`,
    `  createRoutes({`,
    `    routesData: _routes,`,
    `    collectionsData: _collections,`,
    `    collectionLayouts: _collectionLayouts,`,
    `    collectionLists: _collectionLists,`,
    `    collectionPosts: _collectionPosts,`,
    `    config: _config,`,
    `    mdxModules,`,
    `    ${externalOption}`,
    `    externalFilePages: _external_file_pages,`,
    `    externalFileMdx: _external_file_mdx,`,
    `    components: { ${componentMap}${componentMap ? ', ' : ''} ...(_user_mdx_components || {}) },`,
    `  }),`,
    `  ({ isClient }) => {`,
    `    // Boltdocs initialization hook`,
    `    if (isClient) {`,
    `      // Client-side initialization`,
    `    }`,
    `  },`,
    `);`,
    `export { createRoot };`,
    `createRoot.RouteRenderer = RouteRenderer;`,
    `createRoot.matchRouteBranch = matchRouteBranch;`,
    `createRoot.matchRouteBranchWithParams = matchRouteBranchWithParams;`,
    `createRoot.resolveRouteBranch = resolveRouteBranch;`,
    prefetchCode,
  ]

  return `${lines.filter(Boolean).join('\n')}\n`
}
