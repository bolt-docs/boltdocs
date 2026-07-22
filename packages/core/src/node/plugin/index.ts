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
import {
  PluginLifecycleManager,
  validatePlugins,
  type SecureBoltdocsPlugin,
} from '../plugins'
import { createVirtualModulesPlugin } from './virtual-modules'
import { createDevServerPlugin } from '../dev-server/index'
import { boltdocsMdxPlugin } from '../mdx/index'
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
const EXTERNALS = [
  'react',
  'react-dom',
  'react-router-dom',
  'react-helmet-async',
  '@bdocs/ssg',
]

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
  let routes: RouteMeta[] = []

  // Validate plugins and extract vitePlugins synchronously at creation time
  // so they're available when the plugins array is returned to Vite.
  // The config() hook runs AFTER Vite receives the array, so we can't
  // populate resolvedExtraVitePlugins there.
  let resolvedExtraVitePlugins: Plugin[] = []
  if (config?.plugins?.length) {
    try {
      const { version } = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, '../../../package.json'),
          'utf-8',
        ),
      )
      const validated = validatePlugins(config.plugins, version)
      config.plugins = validated as any
      lifecycle = new PluginLifecycleManager(validated, config)
      resolvedExtraVitePlugins = validated.flatMap(
        (p) => (p.vitePlugins || []) as Plugin[],
      )
    } catch {}
  }

  const getConfig = () => config
  const setConfig = (c: BoltdocsConfig) => {
    config = c
  }
  const getViteConfig = () => viteConfig
  const getLifecycle = (): PluginLifecycleManager | undefined => lifecycle

  return [
    {
      name: 'vite-plugin-boltdocs',
      enforce: 'pre',

      async config(userConfig, env) {
        isBuild = env.command === 'build'
        const isSsr = !!(env.isSsrBuild || userConfig.build?.ssr)

        // Cargar variables de entorno globales
        Object.assign(
          process.env,
          loadEnv(env.mode, userConfig.envDir || process.cwd(), ''),
        )

        if (!config) {
          config = await resolveConfig(docsDir)
        }

        if (routes.length === 0) {
          routes = await generateRoutes(docsDir, config)
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

        // Pre-warm Shiki highlighter during plugin load
        import('../mdx/shiki-adapter')
          .then(({ getShikiAdapter }) => {
            const adapter = getShikiAdapter(config)
            adapter.getHighlighter().catch(() => {})
          })
          .catch(() => {})

        // Inicializar ecosistema de subplugins
        const { version } = await import('../../../package.json')
        const validated = validatePlugins(
          config.plugins || ([] as SecureBoltdocsPlugin[]),
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

        if (isBuild) await lifecycle.runHook('beforeBuild')

        // Build the ssgOptions. We add `onPageRendered` so the SSG page
        // renderer calls `transformHtml` lifecycle hooks on every generated
        // page. The callback is a no-op when lifecycle is unavailable.
        const ssgOptions: Record<string, unknown> = {
          entry: 'boltdocs/entry',
          htmlEntry: 'index.html',
          dirStyle: 'flat',
          includeAllRoutes: true,
          mock: true,
          script: 'async',
          beastiesOptions: false,
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
            alias: [
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
              '@bdocs/ssg',
              'jsdom',
              ...getExternalAbsolutePaths(req),
            ],
            optimizeDeps: { include: ['react-fast-compare'] },
            noExternal: ['react-router-dom'],
          },
        }
      },

      configResolved(resolved) {
        viteConfig = resolved
      },

      resolveId(id, _importer, options) {
        const match = EXTERNALS.find(
          (ext) =>
            id === ext ||
            id.startsWith(`${ext}/`) ||
            id.includes(`/node_modules/${ext}/`) ||
            (ext.startsWith('@') &&
              id.includes(`/node_modules/${ext.replace('/', path.sep)}/`)),
        )

        if (
          match &&
          options?.ssr &&
          !path.isAbsolute(id) &&
          match !== 'react' &&
          match !== 'react-dom'
        ) {
          const loader = getBaseRequire(req)
          let resolvedId = id

          try {
            resolvedId = [
              '@bdocs/ssg',
              'react-router-dom',
              'react-helmet-async',
            ].includes(match)
              ? resolveEsm(id, loader)
              : loader.resolve(id)
          } catch {
            try {
              resolvedId = [
                '@bdocs/ssg',
                'react-router-dom',
                'react-helmet-async',
              ].includes(match)
                ? resolveEsm(id, req)
                : req.resolve(id)
            } catch {}
          }

          try {
            resolvedId = fs.realpathSync(resolvedId)
          } catch {}
          return { id: resolvedId, external: true }
        }
        return null
      },

      transformIndexHtml: {
        order: 'pre',
        handler: (html) => injectHtmlMeta(html, config),
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

    // Unified MDX plugin (default) — always included, skips if turbo is active
    ...(!options.turbo ? [boltdocsMdxPlugin(config, getLifecycle)] : []),

    // Sätteri MDX plugin (turbo) — lazy-loaded, skips if turbo is off
    ...(options.turbo
      ? [
          (() => {
            let resolved: any = null

            async function ensure() {
              if (!resolved) {
                try {
                  const { createSatteriMdxPlugin } = await import(
                    '@bdocs/processor-satteri/node'
                  )
                  resolved = createSatteriMdxPlugin(config, getLifecycle)
                } catch {
                  // Sätteri not available — return null for all hooks
                }
              }
              return resolved
            }

            const plugin: Plugin = {
              name: 'vite-plugin-boltdocs-satteri-mdx',
              enforce: 'pre',

              async load(id: string) {
                const p = await ensure()
                if (!p) return null
                if (p.load) return p.load(id)
                return null
              },

              async transform(code: string, id: string) {
                const p = await ensure()
                if (!p) return null
                if (p.transform) return p.transform(code, id)
                return null
              },

              async buildEnd() {
                const p = await ensure()
                if (p && p.buildEnd) await p.buildEnd()
              },
            }

            return plugin
          })(),
        ]
      : []),

    ViteImageOptimizer({ includePublic: true }),

    ...resolvedExtraVitePlugins,
  ]
}
