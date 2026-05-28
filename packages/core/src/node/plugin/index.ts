import { type Plugin, type ResolvedConfig, loadEnv } from 'vite'
import { generateRoutes } from '../routes'
import { adaptRoutesForSSG } from '../routes/route-adapter'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { resolveConfig, type BoltdocsConfig } from '../config'
import { generateProjectTypes, writeLinkTree } from '../types-generator'
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
import { createDevServerPlugin } from '../hmr/index'

// Internal import to avoid top-level side effects
import * as _node_module from 'node:module'

const req = _node_module.createRequire(import.meta.url)

function findPkgJson(resolvedPath: string): string | null {
  let dir = path.dirname(resolvedPath)
  while (dir && dir !== path.dirname(dir)) {
    const pkgJson = path.join(dir, 'package.json')
    if (fs.existsSync(pkgJson)) {
      return pkgJson
    }
    dir = path.dirname(dir)
  }
  return null
}

function parsePackageName(id: string) {
  const parts = id.split('/')
  if (id.startsWith('@')) {
    return {
      packageName: parts.slice(0, 2).join('/'),
      subpath: parts.slice(2).join('/'),
    }
  }
  return {
    packageName: parts[0],
    subpath: parts.slice(1).join('/'),
  }
}

function resolveEsm(packageName: string, customReq = req): string {
  try {
    const { packageName: pkgName, subpath } = parsePackageName(packageName)
    let pkgJsonPath: string
    try {
      pkgJsonPath = customReq.resolve(pkgName + '/package.json')
    } catch (e) {
      const resolvedEntry = customReq.resolve(pkgName)
      pkgJsonPath = findPkgJson(resolvedEntry) || ''
    }

    if (!pkgJsonPath) {
      throw new Error(`Could not find package.json for ${pkgName}`)
    }

    const pkgDir = path.dirname(pkgJsonPath)
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))

    let relativePath = ''
    const exportKey = subpath ? './' + subpath : '.'

    if (pkg.exports) {
      const conds = pkg.exports[exportKey] || pkg.exports[subpath]
      if (conds) {
        if (typeof conds === 'string') {
          relativePath = conds
        } else {
          relativePath = conds.import || conds.default || conds.require || conds
        }
      }
    }

    if (!relativePath && !subpath) {
      relativePath = pkg.module || pkg.main || 'index.js'
    }

    if (typeof relativePath === 'object') {
      relativePath =
        (relativePath as any).import ||
        (relativePath as any).default ||
        (relativePath as any).require ||
        ''
    }

    if (relativePath) {
      const resolved = path.resolve(pkgDir, relativePath)
      if (fs.existsSync(resolved)) {
        return resolved
      }
    }
  } catch (e) {
    // Fallback
  }
  return customReq.resolve(packageName)
}

export function getExternalAbsolutePaths(): string[] {
  const externals = [
    'react',
    'react-dom',
    'react-router-dom',
    'react-helmet-async',
    '@bdocs/ssg',
    'react-fast-compare',
    'invariant',
  ]
  const paths: string[] = []

  // 1. Resolve relative to boltdocs package in consumer app, or process.cwd()
  let baseReq = req
  try {
    const pkgJsonPath = path.join(
      process.cwd(),
      'node_modules/boltdocs/package.json',
    )
    if (fs.existsSync(pkgJsonPath)) {
      const realPkgPath = fs.realpathSync(pkgJsonPath)
      baseReq = _node_module.createRequire(realPkgPath)
    } else {
      baseReq = _node_module.createRequire(
        path.join(process.cwd(), 'package.json'),
      )
    }
  } catch (e) {}

  // Resolve direct externals
  for (const ext of externals) {
    try {
      let resolved = ''
      if (
        ext === '@bdocs/ssg' ||
        ext === 'react-router-dom' ||
        ext === 'react-helmet-async'
      ) {
        resolved = resolveEsm(ext, baseReq)
      } else {
        resolved = baseReq.resolve(ext)
      }
      if (resolved) {
        paths.push(fs.realpathSync(resolved))
      }
    } catch (e) {}
  }

  // Fallback to local resolve if baseReq is different from local req
  if (baseReq !== req) {
    for (const ext of externals) {
      try {
        let resolved = ''
        if (
          ext === '@bdocs/ssg' ||
          ext === 'react-router-dom' ||
          ext === 'react-helmet-async'
        ) {
          resolved = resolveEsm(ext, req)
        } else {
          resolved = req.resolve(ext)
        }
        if (resolved) {
          paths.push(fs.realpathSync(resolved))
        }
      } catch (e) {}
    }
  }

  // Include specific known entrypoints/subpaths
  const subpaths = [
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom/client',
  ]
  for (const sub of subpaths) {
    try {
      paths.push(fs.realpathSync(baseReq.resolve(sub)))
    } catch (e) {}
    if (baseReq !== req) {
      try {
        paths.push(fs.realpathSync(req.resolve(sub)))
      } catch (e) {}
    }
  }

  const uniquePaths = Array.from(new Set(paths))
  return uniquePaths.map((p) => normalizePath(p))
}

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
        const isSsr = !!(
          env.ssrBuild ||
          (env as any).ssr ||
          userConfig.build?.ssr
        )

        // Load env variables
        const envDir = userConfig.envDir || process.cwd()
        const envs = loadEnv(env.mode, envDir, '')
        Object.assign(process.env, envs)

        // Resolve config and generate routes/types async if not already passed
        if (!config) {
          config = await resolveConfig(docsDir)
          const routes = await generateRoutes(docsDir, config)
          const routePaths = routes.map((r) => r.path)
          const basePath = (config.base || '/docs').replace(/\/$/, '')
          if (!routePaths.includes(basePath)) {
            routePaths.push(basePath)
          }
          generateProjectTypes(config, docsDir, undefined, routePaths)
          writeLinkTree(routePaths)
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
          ssgOptions: {
            entry: 'boltdocs/entry',
            htmlEntry: 'index.html',
            dirStyle: 'flat',
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
              {
                find: '@bdocs/ssg',
                replacement: resolveEsm('@bdocs/ssg'),
              },
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
              'react-fast-compare',
              'invariant',
              ...getExternalAbsolutePaths(),
            ],
            optimizeDeps: {
              include: ['react-fast-compare', 'invariant'],
            },
            noExternal: ['react-router-dom'],
          },
        }
      },

      configResolved(resolved) {
        viteConfig = resolved
        lifecycle?.runHook('configResolved', config)
      },

      resolveId(id, importer, options) {
        const externals = [
          'react',
          'react-dom',
          'react-router-dom',
          'react-helmet-async',
          '@bdocs/ssg',
        ]
        const match = externals.find(
          (ext) =>
            id === ext ||
            id.startsWith(ext + '/') ||
            id.includes(`/node_modules/${ext}/`) ||
            (ext.startsWith('@') &&
              id.includes(`/node_modules/${ext.replace('/', path.sep)}/`)),
        )
        if (match) {
          if (options?.ssr) {
            let resolvedId = id
            if (!path.isAbsolute(id)) {
              // Construct baseReq dynamically
              let baseReq = req
              try {
                const pkgJsonPath = path.join(
                  process.cwd(),
                  'node_modules/boltdocs/package.json',
                )
                if (fs.existsSync(pkgJsonPath)) {
                  const realPkgPath = fs.realpathSync(pkgJsonPath)
                  baseReq = _node_module.createRequire(realPkgPath)
                } else {
                  baseReq = _node_module.createRequire(
                    path.join(process.cwd(), 'package.json'),
                  )
                }
              } catch (e) {}

              try {
                if (
                  match === '@bdocs/ssg' ||
                  match === 'react-router-dom' ||
                  match === 'react-helmet-async'
                ) {
                  resolvedId = resolveEsm(id, baseReq)
                } else {
                  resolvedId = baseReq.resolve(id)
                }
              } catch (e) {
                try {
                  if (
                    match === '@bdocs/ssg' ||
                    match === 'react-router-dom' ||
                    match === 'react-helmet-async'
                  ) {
                    resolvedId = resolveEsm(id, req)
                  } else {
                    resolvedId = req.resolve(id)
                  }
                } catch (e2) {}
              }
            }

            try {
              resolvedId = fs.realpathSync(resolvedId)
            } catch (e) {}

            return {
              id: resolvedId,
              external: true,
            }
          }
        }
        return null
      },

      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          return injectHtmlMeta(html, config)
        },
      },

      async buildEnd() {
        // Terminate worker pool threads to prevent resource leaks
        const { pool } = await import('../routes/worker-pool')
        await pool.terminate()
      },

      async closeBundle() {
        if (!isBuild || viteConfig?.build?.ssr) return

        await lifecycle?.runHook('afterBuild')
        await lifecycle?.runHook('buildEnd')
      },

      /**
       * Rewrite requests so that Vite's preview server serves nested SSG
       * HTML files correctly (e.g. /about → /about/index.html), mirroring
       * the behaviour of Vercel's `cleanUrls: true`.
       *
       * Without this, Vite falls back to the root index.html for every
       * path that does not have a matching file, causing the homepage SSR
       * content to hydrate on subpage URLs and producing visible duplication.
       */
      configurePreviewServer(server) {
        // Middleware added DIRECTLY (without returning a function) runs BEFORE
        // Vite's internal static-file middleware, so the URL rewrite takes effect
        // before the file is looked up.  If wrapped in a returned function it
        // would run AFTER – too late to change which file is served.
        const outDir = viteConfig?.build?.outDir
          ? path.resolve(
              viteConfig.root || process.cwd(),
              viteConfig.build.outDir,
            )
          : path.resolve(process.cwd(), 'dist')

        server.middlewares.use((req, _res, next) => {
          const rawUrl = req.url || '/'
          // Strip query-string and hash so we only deal with the pathname.
          const pathname = rawUrl.split('?')[0].split('#')[0]
          // Only rewrite extension-less paths (not /assets/foo.js etc.)
          if (path.extname(pathname)) return next()

          const normalised = pathname.replace(/\/$/, '') || '/'
          const candidate = path.join(outDir, normalised, 'index.html')

          if (normalised !== '/' && fs.existsSync(candidate)) {
            // Rewrite so the static-serve middleware picks up the right file.
            req.url = `${normalised}/index.html${rawUrl.includes('?') ? `?${rawUrl.split('?')[1]}` : ''}`
          }
          next()
        })
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
    {
      ...ViteImageOptimizer({
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
      apply: 'build',
    } as Plugin,

    // === 5. Extra plugins from Boltdocs plugins ===
    ...(() => resolvedExtraVitePlugins)(),
  ]
}
