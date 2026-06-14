import type { Plugin, InlineConfig } from 'vite'
import type { BoltdocsConfig } from './config'
import type { BoltdocsPluginOptions } from './plugin/index'
import path from 'node:path'
export { generateEntryCode } from './plugin/entry'

export default async function boltdocs(
  options?: BoltdocsPluginOptions,
): Promise<Plugin[]> {
  const { resolveConfig } = await import('./config')
  const { generateRoutes, getExternalRoutePaths } = await import('./routes')
  const { generateProjectTypes, writeLinkTree } = await import('./types-generator')
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

  const mergedOptions: BoltdocsPluginOptions = {
    ...options,
  }

  return boltdocsPlugin(mergedOptions, config)
}

/**
 * Generates the complete Vite configuration for a Boltdocs project.
 * This is used by the Boltdocs CLI to run Vite without a user-defined vite.config.ts.
 */
export async function createViteConfig(
  root: string,
  mode: 'development' | 'production' = 'development',
  preResolvedConfig?: BoltdocsConfig,
): Promise<InlineConfig> {
  const [
    reactMod,
    tailwindcssMod,
    { boltdocsPlugin, getExternalAbsolutePaths },
    { SECURITY_HEADERS },
    { getCSPHeader },
    { resolveConfig },
    { generateRoutes },
    { generateProjectTypes, writeLinkTree, getExternalRoutePaths },
    { normalizePath },
  ] = await Promise.all([
    import('@vitejs/plugin-react'),
    import('@tailwindcss/vite'),
    import('./plugin/index'),
    import('./security/headers'),
    import('./security/csp'),
    import('./config'),
    import('./routes'),
    import('./types-generator'),
    import('vite').then((m) => ({ normalizePath: m.normalizePath })),
  ])

  const react = reactMod.default
  const tailwindcss = tailwindcssMod.default

  const config = preResolvedConfig || await resolveConfig('docs', root)
  const routes = await generateRoutes('docs', config)
  const routePaths = routes.map((r) => r.path)
  const basePath = (config.base || '/docs').replace(/\/$/, '')
  if (!routePaths.includes(basePath)) {
    routePaths.push(basePath)
  }
  const externalPaths = getExternalRoutePaths('docs', config)
  for (const p of externalPaths) {
    if (!routePaths.includes(p)) routePaths.push(p)
  }
  generateProjectTypes(config, 'docs', root, routePaths)
  writeLinkTree(routePaths)
  const isProd = mode === 'production'

  // Prepare security headers
  const securityHeaders: Record<string, string> = isProd
    ? { ...SECURITY_HEADERS }
    : {}
  if (config.security?.enableCSP) {
    securityHeaders['Content-Security-Policy'] = getCSPHeader(config)
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
    build: {},
    plugins: [
      react(),
      tailwindcss(),
      ...boltdocsPlugin(
        { docsDir: 'docs', root } as BoltdocsPluginOptions,
        config,
      ),
    ],
    resolve: {
      alias: [
        {
          find: 'boltdocs/entry',
          replacement: normalizePath(path.resolve(root, 'boltdocs-entry.tsx')),
        },
        {
          find: 'boltdocs/client',
          replacement: normalizePath(path.resolve(root, 'boltdocs-client.mjs')),
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
          replacement: normalizePath(
            path.resolve(root, '../packages/core/src'),
          ),
        },
      ],
      dedupe: ['react', 'react-dom'],
    },
    ssr: {
      external: [
        'react',
        'react-dom',
        'react-helmet-async',
        '@bdocs/ssg',
        'react-fast-compare',
        'invariant',
        ...getExternalAbsolutePaths(),
      ],
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react-fast-compare',
          'invariant',
          ...(config.vite?.ssr?.optimizeDeps?.include || []),
        ],
      },
      noExternal: [
        'boltdocs',
        /@bdocs\/(?!ssg).*/,
        'react-aria-components',
        '@react-aria/collections',
        '@react-aria/utils',
        'react-router-dom',
      ],
    },
    server: {
      headers: {
        ...securityHeaders,
        ...config.vite?.server?.headers,
      },
      ...config.vite?.server,
    },
    preview: {
      headers: {
        ...securityHeaders,
        ...config.vite?.preview?.headers,
      },
      ...config.vite?.preview,
    },
    ...config.vite,
  }

  return viteConfig
}

export type { RouteMeta } from './routes'
export type {
  BoltdocsConfig,
  BoltdocsThemeConfig,
  BoltdocsPlugin,
} from './config'
export { defineConfig } from '../shared/config-utils'
export * from './plugins'
export * from './feedback/adapters'
export type { BoltdocsPluginOptions }
export { handleFeedback } from './feedback/handler'
export { normalizePath, sanitizeFilename } from './utils'
export { resolveConfig } from './config'
export { AssetCache, flushCache } from './cache'
