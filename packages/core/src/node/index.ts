import type { Plugin, InlineConfig } from 'vite'
import type { BoltdocsConfig } from './config'
import type { BoltdocsPluginOptions } from './plugin/index'
import type { RouteMeta } from './routes/types'
import path from 'node:path'
import crypto from 'node:crypto'
import { ssrDirnamePolyfillPlugin } from './plugins/ssr-dirname-polyfill'
export { generateEntryCode } from './plugin/entry'

// In-memory cache keyed by `${root}::${mode}::${optionsHash}` where
// optionsHash is derived from routes + flags.  This prevents the heavy
// module imports (react plugin, tailwind, boltdocsPlugin) from being
// repeated when createViteConfig is called multiple times with the
// same configuration — which happens because the pipeline ConfigResolveStep
// calls createViteConfig once, and the build process can call it again
// during dev server setup (previewAction).
const _createViteConfigCache = new Map<string, { config: InlineConfig }>()

function createViteConfigCacheKey(
  root: string,
  mode: string,
  options: CreateViteConfigOptions,
  preResolvedConfig?: BoltdocsConfig,
): string {
  const hash = crypto
    .createHash('md5')
    .update(
      JSON.stringify({
        root,
        mode,
        routeCount: options.routes?.length ?? 0,
        skipTypes: options.skipTypes ?? false,
        skipLinkTree: options.skipLinkTree ?? false,
        hasPreResolved: !!preResolvedConfig,
      }),
    )
    .digest('hex')
  return `${root}::${mode}::${hash}`
}

export interface CreateViteConfigOptions {
  /** Pre-computed routes. When provided, route generation is skipped. */
  routes?: RouteMeta[]
  /** Skip generating project types (they were already generated elsewhere). */
  skipTypes?: boolean
  /** Skip writing the link tree (it was already written elsewhere). */
  skipLinkTree?: boolean
}

export default async function boltdocs(
  options?: BoltdocsPluginOptions,
): Promise<Plugin[]> {
  const { resolveConfig } = await import('./config')
  const { generateRoutes, getExternalRoutePaths } = await import('./routes')
  const { generateProjectTypes, writeLinkTree } = await import(
    './types-generator'
  )
  const { boltdocsPlugin } = await import('./plugin/index')

  const docsDir = options?.docsDir || 'docs'
  const config = await resolveConfig(docsDir)
  const routes = await generateRoutes(docsDir, config)
  const routePaths = routes.map((r) => r.path)
  const basePath = (config.base || '/docs').replace(/\/$/, '')
  if (!routePaths.includes(basePath)) {
    routePaths.push(basePath)
  }
  const externalPaths = getExternalRoutePaths(docsDir, config)
  for (const p of externalPaths) {
    if (!routePaths.includes(p)) routePaths.push(p)
  }
  generateProjectTypes(config, docsDir, undefined, routePaths)
  writeLinkTree(routePaths)

  // Pass pre-computed routes into the plugin so the config() hook does not
  // regenerate them. This removes duplicate work between this entry point and
  // the plugin. Preserve any routes the caller already supplied.
  return boltdocsPlugin(
    { ...options, routes: options?.routes ?? routes } as BoltdocsPluginOptions,
    config,
  )
}

/**
 * Generates the complete Vite configuration for a Boltdocs project.
 * This is used by the Boltdocs CLI to run Vite without a user-defined vite.config.ts.
 */
export async function createViteConfig(
  root: string,
  mode: 'development' | 'production' = 'development',
  preResolvedConfig?: BoltdocsConfig,
  options: CreateViteConfigOptions = {},
): Promise<InlineConfig> {
  // In-memory cache hit: return the pre-built InlineConfig without
  // importing any modules or re-creating plugins. The cache is keyed by
  // root + mode + options hash (config is already stable).
  const cacheKey = createViteConfigCacheKey(
    root,
    mode,
    options,
    preResolvedConfig,
  )
  const cached = _createViteConfigCache.get(cacheKey)
  if (cached) return cached.config

  // Lazy imports: import modules only when first needed, then cache them.
  // Node.js caches modules after the first import, so subsequent calls to
  // createViteConfig that hit the in-memory cache skip this entirely.
  //
  // reactPlugin and tailwindPlugin are ONLY needed when building the
  // final plugin array — they're not needed for the logic above.
  // Import them lazily so the caller doesn't pay for heavy dependencies
  // until the plugin array is actually constructed (~500ms saved on first
  // cold call, since @vitejs/plugin-react pulls in Babel and
  // @tailwindcss/vite pulls in the Tailwind CSS engine).
  let _reactPlugin: any = null
  let _boltdocsPlugin: any = null
  let _getExternalAbsolutePaths: any = null
  let _SECURITY_HEADERS: Record<string, string> | null = null
  let _normalizePath: any = null

  async function ensureImports() {
    if (_normalizePath) return

    const importPromises: Promise<any>[] = [
      import('@vitejs/plugin-react'),
      import('./plugin/index'),
      import('./security/headers'),
      import('vite').then((m) => ({ normalizePath: m.normalizePath })),
    ]

    const results = await Promise.all(importPromises)
    _reactPlugin = results[0].default
    _boltdocsPlugin = results[1].boltdocsPlugin
    _getExternalAbsolutePaths = results[1].getExternalAbsolutePaths
    _SECURITY_HEADERS = results[2].SECURITY_HEADERS
    _normalizePath = results[3].normalizePath
  }

  // Start heavy plugin imports immediately so they run in parallel with
  // config resolution and route generation below (~300-450ms saved).
  const importsPromise = ensureImports()

  const config =
    preResolvedConfig ||
    (await (async () => {
      const { resolveConfig } = await import('./config')
      return resolveConfig('docs', root)
    })())

  const routes =
    options.routes ??
    (await (async () => {
      const { generateRoutes } = await import('./routes')
      return generateRoutes('docs', config, undefined, false)
    })())

  const isProd = mode === 'production'

  // Prepare security headers — these don't depend on routes, so run them
  // in parallel with the types/link-tree generation below.
  const securityHeadersPromise: Promise<Record<string, string>> = (async () => {
    await ensureImports()
    const headers: Record<string, string> = isProd
      ? { ..._SECURITY_HEADERS! }
      : {}
    if (config.security?.enableCSP) {
      const { getCSPHeader } = await import('./security/csp')
      headers['Content-Security-Policy'] = getCSPHeader(config)
    }
    return headers
  })()

  // Only build routePaths for types/link-tree when we actually need them.
  const shouldGenerateTypes = !options.skipTypes
  const shouldGenerateLinkTree = !options.skipLinkTree
  if (shouldGenerateTypes || shouldGenerateLinkTree) {
    const [
      { generateRoutes, getExternalRoutePaths },
      { generateProjectTypes, writeLinkTree },
    ] = await Promise.all([import('./routes'), import('./types-generator')])
    const routePaths = routes.map((r) => r.path)
    const basePath = (config.base || '/docs').replace(/\/$/, '')
    if (!routePaths.includes(basePath)) {
      routePaths.push(basePath)
    }
    const externalPaths = getExternalRoutePaths('docs', config)
    for (const p of externalPaths) {
      if (!routePaths.includes(p)) routePaths.push(p)
    }
    if (shouldGenerateTypes) {
      generateProjectTypes(config, 'docs', root, routePaths)
    }
    if (shouldGenerateLinkTree) {
      writeLinkTree(routePaths)
    }
  }
  const securityHeaders = await securityHeadersPromise

  await ensureImports()

  // Collect PostCSS plugins and preprocessor options registered by CSS plugins
  const postcssPlugins: any[] = []
  const preprocessorOptions: Record<string, any> = {}

  if (config.plugins) {
    for (const p of config.plugins) {
      if (p.css?.postcssPlugins) {
        postcssPlugins.push(...p.css.postcssPlugins)
      }
      if (p.css?.preprocessorOptions) {
        Object.assign(preprocessorOptions, p.css.preprocessorOptions)
      }
    }
  }

  const viteConfig: InlineConfig = {
    root,
    mode,
    oxc: {
      jsx: {
        development: !isProd,
        runtime: 'automatic',
        importSource: 'react',
      },
    },
    optimizeDeps: {
      entries: ['index.html'],
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react-helmet-async',
        'react-router-dom',
        'react-fast-compare',
        'invariant',
        'use-sync-external-store/shim',
      ],
    },
    css:
      postcssPlugins.length > 0 || Object.keys(preprocessorOptions).length > 0
        ? {
            postcss:
              postcssPlugins.length > 0
                ? { plugins: postcssPlugins }
                : undefined,
            preprocessorOptions:
              Object.keys(preprocessorOptions).length > 0
                ? preprocessorOptions
                : undefined,
          }
        : undefined,
    build: {},
    plugins: [
      ssrDirnamePolyfillPlugin(),
      _reactPlugin(),
      ..._boltdocsPlugin(
        { docsDir: 'docs', root, routes } as BoltdocsPluginOptions,
        config,
      ),
    ],
    resolve: {
      alias: [
        {
          find: 'boltdocs/entry',
          replacement: _normalizePath(path.resolve(root, 'boltdocs-entry.tsx')),
        },
        {
          find: 'boltdocs/client',
          replacement: _normalizePath(
            path.resolve(root, 'boltdocs-client.mjs'),
          ),
        },
        {
          find: 'use-sync-external-store/shim/index.js',
          replacement: 'react',
        },
        {
          find: 'use-sync-external-store/shim',
          replacement: 'react',
        },
        {
          find: 'use-sync-external-store',
          replacement: 'react',
        },
        {
          find: '@',
          replacement: _normalizePath(
            path.resolve(root, '../packages/core/src'),
          ),
        },
      ],
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    ssr: {
      external: [
        'react',
        'react-dom',
        'react-helmet-async',
        'react-router-dom',
        '@bdocs/ssg',
        'jsdom',
        ..._getExternalAbsolutePaths(),
      ],
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react-fast-compare',
          ...((((config.vite as any)?.ssr?.optimizeDeps?.include as
            | string[]
            | undefined) ?? []) as string[]),
        ],
      },
      // Keep empty: externalize all framework/runtime packages so they use a
      // single shared instance from node_modules. Bundling react-router-dom
      // while @bdocs/ssg is external created duplicate router contexts and
      // caused "useLocation() may be used only in the context of a <Router>".
      noExternal: [],
    },
    server: {
      watch: {
        ignored: [
          '**/.boltdocs/**',
          ...(((config.vite as any)?.server?.watch?.ignored ?? []) as string[]),
        ],
      },
      headers: {
        ...securityHeaders,
        ...(config.vite as any)?.server?.headers,
      },
      ...(config.vite as any)?.server,
    } as any,
    preview: {
      headers: {
        ...securityHeaders,
        ...(config.vite as any)?.preview?.headers,
      },
      ...(config.vite as any)?.preview,
    } as any,
    ...((config.vite as any) ?? {}),
  }

  // Populate in-memory cache so the next caller with the same parameters
  // skips all module imports + plugin creation + config building.
  _createViteConfigCache.set(cacheKey, { config: viteConfig })

  return viteConfig
}

export { generateRoutes, invalidateRouteCache } from './routes'
export type { RouteMeta } from './routes'
export type {
  BoltdocsConfig,
  BoltdocsThemeConfig,
} from './config'
export { defineConfig } from '../shared/config-utils'
export * from './plugins'
export type { IPluginLifecycleManager } from '../shared/types'
export * from './feedback/adapters'
export type { BoltdocsPluginOptions }
export { handleFeedback } from './feedback/handler'
export { normalizePath, sanitizeFilename } from './utils'
export { resolveConfig } from './config'
export { flushCache } from './cache'
