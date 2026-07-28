import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { type Plugin, type ResolvedConfig, loadEnv } from 'vite'
import { ViteImageOptimizer } from '@bdocs/plugin-image-optimizer'

import { generateRoutes, getExternalRoutePaths } from '../routes'
import type { RouteMeta } from '../routes/types'
import { resolveConfig, type BoltdocsConfig } from '../config'
import { generateProjectTypes, writeLinkTree } from '../types-generator'
import { normalizePath } from '../utils'
import { injectHtmlMeta } from './html'
import { validatePlugins, type BoltdocsPlugin } from '../plugins'
import { PluginLifecycleManager } from '../plugins/plugin-lifecycle'
import type { IPluginLifecycleManager } from '../../shared/types'
import { createVirtualModulesPlugin } from './virtual-modules'
import { createDevServerPlugin } from '../dev-server/index'
import { createSatteriMdxPlugin } from '@bdocs/processor-satteri/node'
import type { BoltdocsPluginOptions } from './types'

import {
  getBaseRequire,
  resolveEsm,
  getExternalAbsolutePaths,
} from './resolver'

export { getBaseRequire, resolveEsm, getExternalAbsolutePaths }
import {
  createFeedbackMiddleware,
  createStaticHtmlMiddleware,
} from './middlewares'
import {
  applyPluginServerMiddleware,
  runPluginServerStartCallbacks,
} from '../plugins/plugin-context'

export * from './types'

const req = createRequire(import.meta.url)
// Fast externals matching: Set for exact, prefixes array for startsWith
const EXACT_EXTERNALS = new Set([
  'react',
  'react-dom',
  'react-router-dom',
  'react-helmet-async',
  '@bdocs/ssg',
  'lucide-react',
  'react-fast-compare',
  'invariant',
  'scheduler',
])
const EXTERNALS_PREFIXES = [
  'react/',
  'react-dom/',
  'react-router-dom/',
  'react-helmet-async/',
  '@bdocs/ssg/',
  'lucide-react/',
  'scheduler/',
]
// Subset that need SSR external resolution (not react/react-dom which are handled by Vite)
const SSR_RESOLVE_EXTERNALS = new Set([
  '@bdocs/ssg',
  'react-router-dom',
  'react-helmet-async',
])

// Memoize resolveId results keyed by `${id}::${ssr}`.
//
// The `importer` was deliberately excluded from the key because the
// resolution result for **every** code path (non-matching, exact external,
// prefix match, node_modules match, pre-resolved SSR external) is
// invariant with respect to the importer.  Only the unreachable fallback
// branch (SSR + no pre-resolved entry + dynamic require.resolve) could
// theoretically depend on the importer, and that branch never runs once
// configResolved has populated _preResolvedExternals.
//
// On a cold build with 2000 modules and ~50 imports each this reduces the
// cache from ~100 000 entries to ~1000 entries, and turns ~100 000 full
// resolution passes into ~1000 — the remaining 99 000 calls are O(1) Map
// hits that return immediately.
let _resolveIdCache: Map<
  string,
  { id: string; external: boolean } | null
> | null = null

function getResolveIdCache() {
  if (!_resolveIdCache) {
    _resolveIdCache = new Map<
      string,
      { id: string; external: boolean } | null
    >()
  }
  return _resolveIdCache
}

function cacheKey(id: string, ssr: boolean | undefined) {
  return `${id}::${ssr ? '1' : '0'}`
}

const EXTERNALS = [
  'react',
  'react-dom',
  'react-router-dom',
  'react-helmet-async',
  '@bdocs/ssg',
  'lucide-react',
  'react-fast-compare',
  'invariant',
  'scheduler',
]

// Cache boltdocs version read once per process — avoids redundant fs.readFileSync + JSON.parse
// on every boltdocsPlugin() construction call.
let _cachedBoltdocsVersion: string | null = null

function _getBoltdocsVersion(): string {
  if (!_cachedBoltdocsVersion) {
    _cachedBoltdocsVersion = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../../package.json'),
        'utf-8',
      ),
    ).version
  }
  return _cachedBoltdocsVersion
}

// PR-01: Memoize plugin validation by config.plugins JSON hash.
// validatePlugins reads package.json for every plugin, checks version
// compatibility, and validates the plugin schema.  On cold builds where
// boltdocsPlugin() is called multiple times (client + SSR builds),
// this avoids duplicating the ~500ms validation work.
const _pluginValidationCache = new Map<
  string,
  { validated: BoltdocsPlugin[] }
>()

// Cache for SSR external resolution — pre-resolves once, serves per-import cache hits
let _preResolvedExternals: Map<string, string> | null = null

export function boltdocsPlugin(
  options: BoltdocsPluginOptions = {},
  passedConfig?: BoltdocsConfig,
): Plugin[] {
  const docsDir = path.resolve(process.cwd(), options.docsDir || 'docs')
  const normalizedDocsDir = normalizePath(docsDir)

  let config: BoltdocsConfig = passedConfig!
  let viteConfig: ResolvedConfig
  let isBuild = false
  let lifecycle: PluginLifecycleManager
  // Pre-computed routes supplied by the pipeline / createViteConfig.
  let routes: RouteMeta[] = options.routes ?? []
  // Cache routes between client and server build config() invocations
  let _routesCachePromise: Promise<RouteMeta[]> | null = null

  // Validate plugins and extract vitePlugins synchronously at creation time
  // so they're available when the plugins array is returned to Vite.
  // The config() hook runs AFTER Vite receives the array, so we can't
  // populate resolvedExtraVitePlugins there.
  //    // PR-01: Memoize plugin validation by plugins array hash.
  // On cold builds, boltdocsPlugin() is called twice (client + SSR),
  // but the plugins array is identical.  The cache avoids re-reading
  // each plugin's package.json and re-validating the schema (~500ms saved).
  //
  // Also cache the package.json read per process (the version doesn't
  // change within a single Node.js process).
  let resolvedExtraVitePlugins: Plugin[] = []
  if (config?.plugins?.length) {
    try {
      const cacheKey = JSON.stringify(
        config.plugins.map((p: any) => p.name || '').sort(),
      )
      const cached = _pluginValidationCache.get(cacheKey)
      if (cached) {
        const validated = cached.validated
        config.plugins = validated as any
        lifecycle = new PluginLifecycleManager(validated, config)
        resolvedExtraVitePlugins = validated.flatMap(
          (p) => (p.vitePlugins || []) as Plugin[],
        )
      } else {
        const version = _getBoltdocsVersion()
        const validated = validatePlugins(config.plugins, version)
        config.plugins = validated as any
        lifecycle = new PluginLifecycleManager(validated, config)
        resolvedExtraVitePlugins = validated.flatMap(
          (p) => (p.vitePlugins || []) as Plugin[],
        )
        _pluginValidationCache.set(cacheKey, { validated })
      }
    } catch {}
  }

  // Cache ssgOptions object so it's not rebuilt per `config()` hook call.
  // The object contains callbacks (onPageRendered) that reference the same
  // lifecycle and config — those are stable within a single process.
  let _ssgOptionsCache: Record<string, unknown> | null = null

  const getConfig = () => config
  const setConfig = (c: BoltdocsConfig) => {
    config = c
  }
  const getViteConfig = () => viteConfig
  const getLifecycle = (): IPluginLifecycleManager | undefined => lifecycle

  return [
    {
      name: 'vite-plugin-boltdocs',
      enforce: 'pre',

      async config(userConfig, env) {
        isBuild = env.command === 'build'
        const isSsr = !!(env.isSsrBuild || userConfig.build?.ssr)

        // SSR build: config + routes + lifecycle are already set from the
        // client build's config() call (Vite calls this hook once per build,
        // but for SSG there are two builds: client + SSR).  Skip everything
        // except the essential SSR-specific overrides.
        //
        // IMPORTANT: `build.ssrManifest: true` must be included because
        // the SSG build reads `ssr-manifest.json` from the SSR output dir.
        // ctx.viteConfig (from createViteConfig) has `build: {}` — it does
        // NOT include ssrManifest, so the SSR build MUST set it here.
        if (isSsr && config && routes.length > 0 && lifecycle) {
          return {
            build: { ssrManifest: true },
            ssr: {
              external: [
                'react',
                'react-dom',
                'react-helmet-async',
                'react-router-dom',
                '@bdocs/ssg',
                'jsdom',
                'lucide-react',
                'react-fast-compare',
                'invariant',
                'scheduler',
                ...getExternalAbsolutePaths(req),
              ],
              optimizeDeps: { include: ['react-fast-compare'] },
              noExternal: [],
            },
          }
        }

        // Cargar variables de entorno globales
        Object.assign(
          process.env,
          loadEnv(env.mode, userConfig.envDir || process.cwd(), ''),
        )

        if (!config) {
          config = await resolveConfig(docsDir)
        }

        if (routes.length === 0 && isBuild) {
          // Cache routes to avoid re-generating in SSR build
          if (!_routesCachePromise) {
            _routesCachePromise = generateRoutes(docsDir, config)
          }
          routes = await _routesCachePromise
          const routePaths = routes.map((r) => r.path)
          const basePath = (config.base || '/docs').replace(/\/$/, '')

          if (!routePaths.includes(basePath)) routePaths.push(basePath)

          const externalPaths = getExternalRoutePaths(docsDir, config)
          for (const p of externalPaths) {
            if (!routePaths.includes(p)) routePaths.push(p)
          }

          generateProjectTypes(config, docsDir, undefined, routePaths)
          writeLinkTree(routePaths)
        }
        // If routes were pre-computed by the pipeline, skip generation here.
        // The pipeline (ConfigResolveStep) already wrote types/link-tree.

        // Pre-warm Shiki highlighter in background (non-blocking)
        import('../mdx/shiki-adapter')
          .then(({ getShikiAdapter }) => {
            const adapter = getShikiAdapter(config)
            adapter.getHighlighter().catch(() => {})
          })
          .catch(() => {})

        // Initialize plugin lifecycle (already validated in constructor — skip
        // duplicate validatePlugins call which is expensive). If lifecycle
        // wasn't already created (no plugins at construction time), create it now.
        if (!lifecycle) {
          const { version } = await import('../../../package.json')
          const validated = validatePlugins(
            config.plugins || ([] as BoltdocsPlugin[]),
            version,
          )
          config.plugins = validated as any
          lifecycle = new PluginLifecycleManager(
            validated,
            config,
            docsDir,
            undefined,
            routes,
            viteConfig?.build?.outDir || 'dist',
          )
          resolvedExtraVitePlugins = validated.flatMap(
            (p) => (p.vitePlugins || []) as Plugin[],
          )
        }

        if (isBuild) await lifecycle?.runHook('beforeBuild')

        // Build the ssgOptions once and cache it.  The `onPageRendered`
        // callback references the same lifecycle instance for the entire
        // process, so it's safe to reuse.
        if (!_ssgOptionsCache) {
          // Map config `ssg.criticalCss: 'none'` → `criticalCss: false` for the SSG build
          const configCriticalCss = config.ssg?.criticalCss
          const resolvedCriticalCss: 'zig-critters' | 'beasties' | false =
            configCriticalCss === 'none'
              ? false
              : configCriticalCss === 'beasties'
                ? 'beasties'
                : 'zig-critters'

          _ssgOptionsCache = {
            entry: 'boltdocs/entry',
            htmlEntry: 'index.html',
            dirStyle: 'flat',
            includeAllRoutes: true,
            mock: true,
            script: 'async',
            beastiesOptions: false,
            criticalCss: resolvedCriticalCss,
            onPageRendered: async (
              path: string,
              renderedHTML: string,
            ): Promise<string> => {
              if (!lifecycle) return renderedHTML
              try {
                const result = await lifecycle.runChain('transformHtml', {
                  html: renderedHTML,
                  path,
                })
                let html = result.html
                // Run middleware chain after lifecycle hooks
                const middlewareResult = await lifecycle.runMiddlewareChain(
                  'transformHtml',
                  { html, path },
                )
                html = middlewareResult.html
                return html
              } catch {
                return renderedHTML
              }
            },
          }
        }
        const ssgOptions = _ssgOptionsCache

        return {
          ssgOptions,
          build: { ssrManifest: isBuild },
          optimizeDeps: {
            include: [
              'react',
              'react-dom',
              'react-dom/client',
              'react-router-dom',
              'react-helmet-async',
              'react-fast-compare',
              'invariant',
            ],
            exclude: ['boltdocs', 'boltdocs/client'],
          },
          resolve: {
            alias: isSsr
              ? []
              : [
                  {
                    find: 'react-router-dom',
                    replacement: resolveEsm('react-router-dom'),
                  },
                  {
                    find: 'react-helmet-async',
                    replacement: resolveEsm('react-helmet-async'),
                  },
                  { find: '@bdocs/ssg', replacement: resolveEsm('@bdocs/ssg') },
                ],
            dedupe: [
              'react',
              'react-dom',
              ...(isSsr
                ? []
                : ['react-router-dom', 'react-helmet-async', '@bdocs/ssg']),
            ],
          },
          ssr: {
            external: [
              'react',
              'react-dom',
              'react-helmet-async',
              'react-router-dom',
              '@bdocs/ssg',
              'jsdom',
              'lucide-react',
              'react-fast-compare',
              'invariant',
              'scheduler',
              ...getExternalAbsolutePaths(req),
            ],
            optimizeDeps: { include: ['react-fast-compare'] },
            // Externalize all framework packages so @bdocs/ssg and the docs
            // app share a single react-router-dom instance/context.
            noExternal: [],
          },
        }
      },

      configResolved(resolved) {
        viteConfig = resolved

        // Pre-resolve all SSR externals once (avoids redundant resolveEsm + realpathSync per import)
        if (!_preResolvedExternals) {
          _preResolvedExternals = new Map()
          for (const ext of SSR_RESOLVE_EXTERNALS) {
            try {
              const resolved = resolveEsm(ext)
              const real = fs.realpathSync(resolved)
              _preResolvedExternals.set(ext, real)
            } catch {}
          }
          for (const ext of [
            'react',
            'react-dom',
            'jsdom',
            'lucide-react',
            'react-fast-compare',
            'invariant',
            'scheduler',
          ]) {
            try {
              const resolved = req.resolve(ext)
              const real = fs.realpathSync(resolved)
              _preResolvedExternals.set(ext, real)
            } catch {}
          }
        }
      },

      resolveId(id, _importer, options) {
        // Fast path: cache by id + ssr.  importer is excluded from the key
        // because the resolution result is invariant wrt the importer (see
        // the comment on getResolveIdCache).  The key change reduced cache
        // entries from ~100k to ~1k on cold builds.
        const cache = getResolveIdCache()
        const key = cacheKey(id, options?.ssr)
        const cached = cache.get(key)
        if (cached !== undefined) {
          return cached
        }

        // Quick rejection for non-matching bare specifiers.
        // Most imports don't match EXTERNALS, so skip early.
        if (!path.isAbsolute(id) && !id.startsWith('.')) {
          if (
            !EXACT_EXTERNALS.has(id) &&
            !id.startsWith('react') &&
            !id.startsWith('@bdocs')
          ) {
            cache.set(key, null)
            return null
          }
        }

        // Determine if id matches any external
        let match: string | null = null

        // Exact match (bare specifier like 'react-router-dom')
        if (EXACT_EXTERNALS.has(id)) {
          match = id
        }

        // Prefix match (bare specifier with sub-path like 'react-router-dom/xxx')
        if (!match && !path.isAbsolute(id) && !id.startsWith('.')) {
          const prefix = EXTERNALS_PREFIXES.find((p) => id.startsWith(p))
          if (prefix) {
            match = prefix.slice(0, -1) // Remove trailing '/'
          }
        }

        // node_modules match (resolved path like /path/node_modules/react-router-dom/xxx)
        if (!match && id.includes('/node_modules/')) {
          for (const ext of EXTERNALS) {
            if (id.includes(`/node_modules/${ext}/`)) {
              match = ext
              break
            }
          }
        }

        if (
          match &&
          options?.ssr &&
          !path.isAbsolute(id) &&
          match !== 'react' &&
          match !== 'react-dom'
        ) {
          // Use pre-resolved cache — resolves once, serves all subsequent imports
          const preResolved = _preResolvedExternals?.get(match)
          if (preResolved) {
            const result = { id: preResolved, external: true }
            cache.set(key, result)
            return result
          }

          // Fallback: resolve on-the-fly (should rarely happen)
          const loader = getBaseRequire(req)
          let resolvedId = id
          try {
            resolvedId = SSR_RESOLVE_EXTERNALS.has(match)
              ? resolveEsm(id, loader)
              : loader.resolve(id)
          } catch {
            try {
              resolvedId = SSR_RESOLVE_EXTERNALS.has(match)
                ? resolveEsm(id, req)
                : req.resolve(id)
            } catch {}
          }
          try {
            resolvedId = fs.realpathSync(resolvedId)
          } catch {}
          const result = { id: resolvedId, external: true }
          cache.set(key, result)
          return result
        }
        cache.set(key, null)
        return null
      },

      transformIndexHtml: {
        order: 'pre',
        handler: (html) => injectHtmlMeta(html, config),
      },

      configureServer(server) {
        // Serve search.json dynamically in dev so the client can fetch the
        // index lazily without bundling it into the JS payload.
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0]
          if (url === '/search.json' || url?.endsWith('/search.json')) {
            import('./virtual-modules')
              .then(({ getSearchDataExport }) => {
                const data = getSearchDataExport()
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(data))
              })
              .catch((err) => {
                console.error('[boltdocs] Failed to serve search.json:', err)
                res.statusCode = 500
                res.end('[]')
              })
            return
          }
          next()
        })
      },

      async generateBundle() {
        // Emit search.json as a static asset in production builds so the
        // client can fetch it lazily instead of embedding it in the bundle.
        if (!isBuild || viteConfig?.build?.ssr) return
        try {
          const { getSearchDataExport } = await import('./virtual-modules')
          const data = getSearchDataExport()
          this.emitFile({
            type: 'asset',
            fileName: 'search.json',
            source: JSON.stringify(data),
          })
        } catch (err) {
          console.error('[boltdocs] Failed to emit search.json:', err)
        }
      },

      async closeBundle() {
        if (!isBuild || viteConfig?.build?.ssr) return
        await lifecycle?.runHook('afterBuild')
        await lifecycle?.runHook('buildEnd')
      },

      configurePreviewServer(server) {
        // Acoplamos los middlewares limpios importados
        server.middlewares.use(createFeedbackMiddleware(getConfig))
        server.middlewares.use(createStaticHtmlMiddleware(getViteConfig))

        // Apply plugin-registered server middleware on preview too
        applyPluginServerMiddleware(server)
        runPluginServerStartCallbacks().catch(() => {})
      },
    },

    createVirtualModulesPlugin(options, getConfig, getViteConfig, docsDir),
    createDevServerPlugin(
      docsDir,
      normalizedDocsDir,
      getConfig,
      setConfig,
      getLifecycle,
    ),

    // Sätteri MDX processor — Rust-based, fast, always active
    // (replaced the old @mdx-js/rollup pipeline entirely)
    createSatteriMdxPlugin(config, getLifecycle, {
      docsDir: options.docsDir || 'docs',
    }),

    ViteImageOptimizer({ includePublic: true }),

    ...resolvedExtraVitePlugins,
  ]
}
