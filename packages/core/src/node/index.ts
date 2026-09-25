import type { CSSOptions, InlineConfig, Plugin, UserConfig } from 'vite'
import type { Options as ReactPluginOptions } from '@vitejs/plugin-react'
import type { BoltdocsConfig } from './config'
import type { BoltdocsPluginOptions } from './plugin/index'
import type { RouteMeta } from './routes/types'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { ssrDirnamePolyfillPlugin } from './plugins/ssr-dirname-polyfill'
import { createBoltdocsAliases, normalizeAliases } from './aliases'
export { generateEntryCode } from './plugin/entry'

// In-memory cache keyed by `${root}::${mode}::${optionsHash}` where
// optionsHash is derived from routes + flags.  This prevents the heavy
// module imports (react plugin, tailwind, boltdocsPlugin) from being
// repeated when createViteConfig is called multiple times with the
// same configuration — which happens because the pipeline ConfigResolveStep
// calls createViteConfig once, and the build process can call it again
// during dev server setup (previewAction).
const _createViteConfigCache = new Map<string, { config: InlineConfig }>()

/**
 * Resolves the monorepo `packages/core/src` source root for the core package.
 *
 * The dev server maps `boltdocs/client` to the checked-out source via the
 * `virtual:boltdocs-client.mjs` module, but the remaining framework sub-path
 * entries (`boltdocs/primitives`, `boltdocs/mdx`, `boltdocs/client/router`)
 * fall through to the built `dist` bundle. The dist bundle carries its own
 * isolated copies of the client contexts (e.g. `ui-context`), so primitives
 * that consume `useUI()` no longer share state with the `UIProvider` mounted
 * by `BoltdocsShell` — causing the mobile sidebar to silently never open.
 *
 * To keep every framework client module on a single shared instance during
 * development, alias all the sub-path entries to this source root when it
 * exists. In a published install (no `src/`) this returns `undefined` and the
 * aliases below are skipped, falling back to the normal dist resolution.
 */
function resolveClientSourceRoot(): string | undefined {
  let currentDir = __dirname
  while (currentDir && currentDir !== path.parse(currentDir).root) {
    const pkgPath = path.join(currentDir, 'package.json')
    if (fs.existsSync(pkgPath)) {
      let name = ''
      try {
        name = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).name || ''
      } catch {
        name = ''
      }
      if (name === 'boltdocs') {
        const src = path.join(currentDir, 'src/client')
        return fs.existsSync(src) ? src : undefined
      }
    }
    currentDir = path.dirname(currentDir)
  }
  return undefined
}

// Computed once at module load: the monorepo client source root, or undefined
// in a published install. Used to keep every framework sub-path entry on the
// same module instance as `boltdocs/client` during development.
const _clientSourceRoot = resolveClientSourceRoot()

function resolvePublicDir(
  root: string,
  config: BoltdocsConfig | undefined,
  explicit?: string | false,
): string | false {
  if (explicit === false) return false
  if (typeof explicit === 'string') return path.resolve(root, explicit)

  const configuredPublicDir = (
    config?.vite as { publicDir?: string | false } | undefined
  )?.publicDir
  if (configuredPublicDir === false) return false
  if (typeof configuredPublicDir === 'string') {
    return path.resolve(root, configuredPublicDir)
  }

  // CLI users commonly run `pnpm -C docs dev`, making `docs/` the Vite
  // root while the content directory is `docs/docs/`. Prefer the root-level
  // public directory in that layout, then support the project-root/docs/public
  // convention used by projects whose root is one level above docsDir.
  const rootPublicDir = path.resolve(root, 'public')
  const docsPublicDir = path.resolve(root, config?.docsDir || 'docs', 'public')
  return fs.existsSync(rootPublicDir) || !fs.existsSync(docsPublicDir)
    ? rootPublicDir
    : docsPublicDir
}

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
        skipRoutes: options.skipRoutes ?? false,
        hasPreResolved: !!preResolvedConfig,
        docsDir: preResolvedConfig?.docsDir || 'docs',
        aliases: preResolvedConfig?.aliases,
        viteAliases: preResolvedConfig?.vite?.resolve?.alias,
        publicDir: resolvePublicDir(root, preResolvedConfig, options.publicDir),
      }),
    )
    .digest('hex')
  return `${root}::${mode}::${hash}`
}

type ReactPluginFactory = (options?: ReactPluginOptions) => Plugin[]
type BoltdocsPluginFactory = (
  options?: BoltdocsPluginOptions,
  passedConfig?: BoltdocsConfig,
) => Plugin[]
type ExternalPathsResolver = () => string[]
type SecurityHeadersResolver = (
  config: BoltdocsConfig,
  isProduction: boolean,
) => Record<string, string>
type NormalizePath = (value: string) => string

export interface CreateViteConfigOptions {
  /** Pre-computed routes. When provided, route generation is skipped. */
  routes?: RouteMeta[]
  /** Skip generating project types (they were already generated elsewhere). */
  skipTypes?: boolean
  /** Skip writing the link tree (it was already written elsewhere). */
  skipLinkTree?: boolean
  /** Skip route generation entirely. Routes will be generated lazily by virtual modules. */
  skipRoutes?: boolean
  /** Static asset directory relative to the project root (default: docs/public). */
  publicDir?: string | false
}

export function shouldEnableBundledDev(
  isProduction: boolean,
  value = process.env.BOLTDOCS_BUNDLED_DEV,
): boolean {
  return !isProduction && value === 'true'
}

export function shouldUseReactPlugin(
  isProduction: boolean,
  base: string,
  value = process.env.BOLTDOCS_REACT_REFRESH,
): boolean {
  if (isProduction) return true
  if (value === 'true') return true
  return base === '/' || base === ''
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

  // Load Vite adapters in parallel with config and route discovery.
  interface ViteRuntimeImports {
    reactPlugin: ReactPluginFactory
    boltdocsPlugin: BoltdocsPluginFactory
    getExternalAbsolutePaths: ExternalPathsResolver
    resolveSecurityHeaders: SecurityHeadersResolver
    normalizePath: NormalizePath
  }

  let importsPromise: Promise<ViteRuntimeImports> | null = null
  function ensureImports(): Promise<ViteRuntimeImports> {
    if (importsPromise) return importsPromise
    importsPromise = Promise.all([
      import('@vitejs/plugin-react'),
      import('./plugin/index'),
      import('./security/resolve'),
      import('vite'),
    ]).then(([reactModule, pluginModule, securityModule, viteModule]) => ({
      reactPlugin: reactModule.default,
      boltdocsPlugin: pluginModule.boltdocsPlugin,
      getExternalAbsolutePaths: pluginModule.getExternalAbsolutePaths,
      resolveSecurityHeaders: securityModule.resolveSecurityHeaders,
      normalizePath: viteModule.normalizePath,
    }))
    return importsPromise
  }

  const imports = ensureImports()

  const config =
    preResolvedConfig ||
    (await (async () => {
      const { resolveConfig } = await import('./config')
      return resolveConfig('docs', root)
    })())

  const docsDir = path.resolve(root, config.docsDir || 'docs')

  const routes =
    options.routes ??
    (options.skipRoutes
      ? []
      : await (async () => {
          const { generateRoutes } = await import('./routes')
          return generateRoutes(docsDir, config, undefined, false)
        })())

  const isProd = mode === 'production'

  // Prepare security headers — these don't depend on routes, so run them
  // in parallel with the types/link-tree generation below.
  const securityHeadersPromise: Promise<Record<string, string>> = imports.then(
    ({ resolveSecurityHeaders }) => resolveSecurityHeaders(config, isProd),
  )

  // Only build routePaths for types/link-tree when we actually need them.
  const shouldGenerateTypes = !options.skipTypes
  const shouldGenerateLinkTree = !options.skipLinkTree
  if (shouldGenerateTypes || shouldGenerateLinkTree) {
    const [{ getExternalRoutePaths }, { generateProjectTypes, writeLinkTree }] =
      await Promise.all([import('./routes'), import('./types-generator')])
    const routePaths = routes.map((r) => r.path)
    const basePath = (config.base || '/docs').replace(/\/$/, '')
    if (!routePaths.includes(basePath)) {
      routePaths.push(basePath)
    }
    const externalPaths = getExternalRoutePaths(docsDir, config)
    for (const p of externalPaths) {
      if (!routePaths.includes(p)) routePaths.push(p)
    }
    if (shouldGenerateTypes) {
      generateProjectTypes(config, docsDir, root, routePaths)
    }
    if (shouldGenerateLinkTree) {
      writeLinkTree(routePaths)
    }
  }
  const securityHeaders = await securityHeadersPromise

  const {
    reactPlugin,
    boltdocsPlugin,
    getExternalAbsolutePaths,
    normalizePath: normalizeVitePath,
  } = await imports

  // Collect PostCSS plugins and preprocessor options registered by CSS plugins
  type PostcssProcessOptions = Exclude<
    CSSOptions['postcss'],
    string | undefined
  >
  type PostcssPlugin = NonNullable<PostcssProcessOptions['plugins']>[number]
  type PreprocessorOptions = NonNullable<CSSOptions['preprocessorOptions']>
  const postcssPlugins: PostcssPlugin[] = []
  const preprocessorOptions: PreprocessorOptions = {}

  if (config.plugins) {
    for (const plugin of config.plugins) {
      if (plugin.css?.postcssPlugins) {
        postcssPlugins.push(
          ...plugin.css.postcssPlugins.filter(
            (value): value is PostcssPlugin =>
              typeof value === 'function' ||
              (typeof value === 'object' && value !== null),
          ),
        )
      }
      if (plugin.css?.preprocessorOptions) {
        Object.assign(
          preprocessorOptions,
          plugin.css.preprocessorOptions as Partial<PreprocessorOptions>,
        )
      }
    }
  }

  const userViteConfig: UserConfig = config.vite ?? {}
  const userServer = userViteConfig.server ?? {}
  const userPreview = userViteConfig.preview ?? {}
  const userSsr = userViteConfig.ssr ?? {}
  const userOptimizeDeps = userViteConfig.optimizeDeps ?? {}
  const userEntries = userOptimizeDeps.entries ?? ['index.html']
  const userSsrExternal = Array.isArray(userSsr.external)
    ? userSsr.external
    : typeof userSsr.external === 'string'
      ? [userSsr.external]
      : []
  const userWatchIgnored = userServer.watch?.ignored
  const watchIgnored = userWatchIgnored
    ? Array.isArray(userWatchIgnored)
      ? ['**/.boltdocs/**', ...userWatchIgnored]
      : ['**/.boltdocs/**', userWatchIgnored]
    : ['**/.boltdocs/**']
  const hasCssConfig =
    userViteConfig.css !== undefined ||
    postcssPlugins.length > 0 ||
    Object.keys(preprocessorOptions).length > 0
  const css = {
    ...userViteConfig.css,
    ...(postcssPlugins.length > 0
      ? { postcss: { plugins: postcssPlugins } }
      : {}),
    ...(Object.keys(preprocessorOptions).length > 0
      ? {
          preprocessorOptions: {
            ...userViteConfig.css?.preprocessorOptions,
            ...preprocessorOptions,
          },
        }
      : {}),
  }

  const effectiveBase = config.base || userViteConfig.base || '/'

  const viteConfig: InlineConfig = {
    ...userViteConfig,
    root,
    mode,
    experimental: {
      ...userViteConfig.experimental,
      bundledDev: shouldEnableBundledDev(isProd),
    },
    oxc: {
      ...userViteConfig.oxc,
      jsx: {
        development: !isProd,
        runtime: 'automatic',
        importSource: 'react',
      },
    },
    optimizeDeps: {
      ...userOptimizeDeps,
      entries: userEntries,
      include: [
        ...(userOptimizeDeps.include ?? []),
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
    css: hasCssConfig ? css : undefined,
    build: userViteConfig.build ?? {},
    plugins: [
      ...(userViteConfig.plugins ?? []),
      ssrDirnamePolyfillPlugin(),
      ...(shouldUseReactPlugin(isProd, effectiveBase) ? reactPlugin() : []),
      ...boltdocsPlugin(
        { docsDir, root, routes } as BoltdocsPluginOptions,
        config,
      ),
    ],
    ssr: {
      ...userSsr,
      external: [
        ...userSsrExternal,
        'react',
        'react-dom',
        'react-helmet-async',
        'react-router-dom',
        '@bdocs/ssg',
        'jsdom',
        ...getExternalAbsolutePaths(),
      ],
      optimizeDeps: {
        ...userSsr.optimizeDeps,
        include: [
          ...(userSsr.optimizeDeps?.include ?? []),
          'react',
          'react-dom',
          'react-fast-compare',
        ],
      },
      noExternal: [],
    },
    server: {
      ...userServer,
      watch: {
        ...userServer.watch,
        ignored: watchIgnored,
      },
      headers: {
        ...securityHeaders,
        ...userServer.headers,
      },
    },
    preview: {
      ...userPreview,
      headers: {
        ...securityHeaders,
        ...userPreview.headers,
      },
    },
    resolve: {
      ...userViteConfig.resolve,
      alias: [
        ...createBoltdocsAliases({
          root,
          clientSourceRoot: _clientSourceRoot,
          aliases: [
            ...normalizeAliases(config.aliases),
            ...normalizeAliases(userViteConfig.resolve?.alias),
          ],
        }).map((alias) => ({
          ...alias,
          ...(typeof alias.replacement === 'string'
            ? { replacement: normalizeVitePath(alias.replacement) }
            : {}),
        })),
      ],
      dedupe: [
        'react',
        'react-dom',
        'react-router-dom',
        ...(userViteConfig.resolve?.dedupe ?? []),
      ],
    },
    base: effectiveBase,
    publicDir: resolvePublicDir(root, config, options.publicDir),
  }

  // Populate in-memory cache so the next caller with the same parameters
  // skips all module imports + plugin creation + config building.
  _createViteConfigCache.set(cacheKey, { config: viteConfig })

  // Expose the resolved config on the returned InlineConfig so callers that
  // skip their own resolveConfig() (devAction) can still read config fields
  // (docsDir, plugins) without resolving the config a second time.
  ;(
    viteConfig as InlineConfig & { __boltdocsConfig: BoltdocsConfig }
  ).__boltdocsConfig = config

  return viteConfig
}

export { generateRoutes, invalidateRouteCache } from './routes'
export type { RouteMeta } from './routes'
export type {
  BoltdocsConfig,
  BoltdocsThemeConfig,
} from './config'
export type {
  StructuredData,
  JsonLdObject,
  JsonLdValue,
  BoltdocsExperimentalConfig,
  BoltdocsViewTransitionsConfig,
  ExternalFileRoute,
} from '../shared/types'
export {
  createArticleStructuredData,
  createBreadcrumbStructuredData,
  createStructuredData,
  createWebSiteStructuredData,
  defineStructuredData,
} from '../shared/structured-data'
export type {
  ArticleStructuredDataOptions,
  BreadcrumbStructuredDataItem,
  StructuredDataFactoryOptions,
  WebSiteStructuredDataOptions,
} from '../shared/structured-data'
export { defineConfig } from '../shared/config-utils'
export * from './plugins'
export type { IPluginLifecycleManager } from '../shared/types'
export * from './feedback/adapters'
export type { BoltdocsPluginOptions }
export { handleFeedback } from './feedback/handler'
export { normalizePath, sanitizeFilename } from './utils'
export { resolveConfig } from './config'
export type {
  CodeHighlighterAdapter,
  CodeHighlighterRuntime,
  CodeHighlightConfig,
  CodeTheme,
  CodeHighlighterEngine,
  ParsedMetaLike,
} from '../shared/types'
export { normalizeCodeHighlightConfig } from '@bdocs/unist-utils'

export * from './highlight/registry'
export { flushCache } from './cache'
