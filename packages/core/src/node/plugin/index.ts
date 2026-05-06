import { type Plugin, type ResolvedConfig, loadEnv } from 'vite'
import { generateRoutes } from '../routes'
import { adaptRoutesForSSG } from '../routes/route-adapter'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import {
  resolveConfigAndGenerateTypes,
  type BoltdocsConfig,
  CONFIG_FILES,
} from '../config'
import { normalizePath } from '../utils'
import { generateSitemap } from '../seo/sitemap'
import { generateRobotsTxt } from '../seo/robots'
import path from 'node:path'
import fs from 'node:fs'
import type { BoltdocsPluginOptions } from './types'
import { injectHtmlMeta } from './html'
import {
  PluginLifecycleManager,
  validatePlugins,
  PluginSandbox,
  type SecureBoltdocsPlugin,
} from '../plugins'
import { createVirtualModulesPlugin } from './virtual-modules'
import { createDevServerPlugin } from './dev-server'

// Internal import to avoid top-level side effects
import * as _node_module from 'node:module'

export * from './types'

/**
 * The core Boltdocs Vite plugin.
 * Orchestrates virtual module resolution, HMR for documentation files,
 * injecting HTML meta tags for SEO, and triggering the SSG process on build.
 *
 * @param options - Optional configuration for the plugin
 * @param passedConfig - Pre-resolved configuration (internal use)
 * @returns An array of Vite plugins
 */
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

  // Use a placeholder for extra plugins that will be populated once config is resolved
  let resolvedExtraVitePlugins: Plugin[] = []

  // Shared accessors for sub-plugins
  const getConfig = () => config
  const setConfig = (c: BoltdocsConfig) => {
    config = c
  }
  const getViteConfig = () => viteConfig
  const getLifecycle = () => lifecycle

  return [
    // === 1. Core plugin: config resolution, SSG options, HTML injection, build hooks ===
    {
      name: 'vite-plugin-boltdocs',
      enforce: 'pre',

      async config(userConfig, env) {
        isBuild = env.command === 'build'

        // Load env variables
        const envDir = userConfig.envDir || process.cwd()
        const envs = loadEnv(env.mode, envDir, '')
        Object.assign(process.env, envs)

        // Resolve config async if not already passed
        if (!config) {
          config = await resolveConfigAndGenerateTypes(docsDir)
        }

        // Secure Plugin Initialization
        const boltdocsVersion = (await import('../../../package.json')).version
        const validatedPlugins = validatePlugins(
          (config.plugins || []) as SecureBoltdocsPlugin[],
          boltdocsVersion,
        )

        config.plugins = validatedPlugins as any

        lifecycle = new PluginLifecycleManager(validatedPlugins, config)

        resolvedExtraVitePlugins = validatedPlugins.flatMap((p) => {
          const caps = PluginSandbox.getSanitizedCapabilities(p)
          return (caps.vitePlugins || []) as Plugin[]
        })

        if (isBuild) {
          await lifecycle.runHook('beforeBuild')
        }

        return {
          // @ts-expect-error - @bdocs/ssg options
          ssgOptions: {
            entry: 'boltdocs/entry',
            htmlEntry: 'index.html',
            dirStyle: 'nested',
            includeAllRoutes: true,
            mock: true,
            script: 'async',
            beastiesOptions: {
              preload: 'media',
            },
            onFinished: async (outDir: string) => {
              const routes = await generateRoutes(docsDir, config)
              const ssgRoutes = adaptRoutesForSSG(routes)

              const sitemap = generateSitemap(ssgRoutes, config)
              if (sitemap) {
                fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap)
              }

              const robots = generateRobotsTxt(config)
              fs.writeFileSync(path.join(outDir, 'robots.txt'), robots)
            },
          },
          build: {
            ssrManifest: isBuild,
          },
          async config() {
            return {
              optimizeDeps: {
                include: [
                  'react',
                  'react-dom',
                  'react-dom/client',
                  'react-router-dom',
                  'react-helmet-async',
                ],
                exclude: ['boltdocs', 'boltdocs/client'],
              },
              resolve: {
                dedupe: ['react', 'react-dom'],
              },
            }
          },
        }
      },

      configResolved(resolved) {
        viteConfig = resolved
        lifecycle?.runHook('configResolved', config)
      },

      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          return injectHtmlMeta(html, config)
        },
      },

      async closeBundle() {
        if (!isBuild || viteConfig?.build?.ssr) return

        await lifecycle?.runHook('afterBuild')
        await lifecycle?.runHook('buildEnd')
      },
    },

    // === 2. Virtual modules plugin: resolveId + load ===
    createVirtualModulesPlugin(options, getConfig, getViteConfig, docsDir),

    // === 3. Dev server plugin: middleware, watchers, HMR ===
    createDevServerPlugin(
      docsDir,
      normalizedDocsDir,
      getConfig,
      setConfig,
      getLifecycle,
    ),

    // === 4. Image optimizer ===
    ViteImageOptimizer({
      includePublic: true,
      png: { quality: 80 },
      jpeg: { quality: 80 },
      jpg: { quality: 80 },
      webp: { quality: 80 },
      avif: { quality: 80 },
      svg: {
        multipass: true,
        plugins: [
          {
            name: 'preset-default',
          },
        ] as any,
      },
    }),

    // === 5. Extra plugins from Boltdocs plugins ===
    ...(() => resolvedExtraVitePlugins)(),
  ]
}
