import type { ViteDevServer, Plugin } from 'vite'
import { invalidateRouteCache, invalidateFile } from '../routes'
import { type BoltdocsConfig, CONFIG_FILES } from '../config'
import { generateProjectTypes } from '../types-generator'
import { normalizePath, isDocFile } from '../utils'
import { SECURITY_HEADERS } from '../security/headers'
import { getCSPHeader } from '../security/csp'
import { getHtmlTemplate, injectHtmlMeta } from './html'
import { invalidateDirectoryMetaCache } from './virtual-modules'
import {
  computeFrontmatterHash,
  getFrontmatterHash,
  setFrontmatterHash,
  removeFrontmatterHash,
} from './frontmatter-cache'
import type { PluginLifecycleManager } from '../plugins'
import { generateLinkTree } from '../cli/doctor'
import path from 'node:path'
import { error } from '@bdocs/dui'

/**
 * Debounce delay for content changes (ms).
 * Collapses rapid consecutive saves (e.g. auto-save) into a single HMR update.
 */
const DEBOUNCE_MS = 150

/**
 * Invalidates a Vite virtual module by its short name (e.g. 'routes', 'config').
 */
function invalidateVirtualModule(server: ViteDevServer, name: string): void {
  const mod = server.moduleGraph.getModuleById(`\0virtual:boltdocs-${name}.ts`)
  if (mod) server.moduleGraph.invalidateModule(mod)
}

/**
 * Creates the Vite plugin responsible for the dev server: security middleware,
 * HTML serving, file watching, and HMR event handling.
 */
export function createDevServerPlugin(
  docsDir: string,
  normalizedDocsDir: string,
  getConfig: () => BoltdocsConfig,
  _setConfig: (c: BoltdocsConfig) => void,
  getLifecycle: () => PluginLifecycleManager | undefined,
): Plugin {
  const pendingChanges = new Map<string, ReturnType<typeof setTimeout>>()

  return {
    name: 'vite-plugin-boltdocs-dev-server',
    apply: 'serve',

    async configureServer(server) {
      const lifecycle = getLifecycle()
      await lifecycle?.runHook('beforeDev')

      // Initial Link Tree generation
      generateLinkTree(docsDir, process.cwd(), getConfig()).catch((e) => {
        error('Failed to generate initial link tree:', e)
      })

      // Asynchronous background pre-warming of routes
      setTimeout(async () => {
        try {
          const { generateRoutes } = await import('../routes')
          const routes = await generateRoutes(docsDir, getConfig())
          for (const route of routes) {
            if (route.filePath) {
              const rel = path
                .relative(process.cwd(), route.filePath)
                .replace(/\\/g, '/')
              const viteUrl = rel.startsWith('/') ? rel : `/${rel}`
              // Warm up the module cache asynchronously
              await server.transformRequest(viteUrl).catch(() => {})
              // Brief delay to prevent blocking the event loop
              await new Promise((resolve) => setTimeout(resolve, 50))
            }
          }
        } catch {
          // Fall back silently on any background failures
        }
      }, 1000)

      // --- Security middleware ---
      server.middlewares.use((_req, res, next) => {
        const isProd = process.env.NODE_ENV === 'production'
        if (isProd) {
          Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
            res.setHeader(header, value)
          })
        }
        const config = getConfig()
        if (config.security?.enableCSP) {
          res.setHeader('Content-Security-Policy', getCSPHeader(config))
        }
        next()
      })

      // robots.txt pass-through in dev
      server.middlewares.use((req, res, next) => {
        if (req.url === '/robots.txt') {
          next()
          return
        }
        next()
      })

      // --- HTML serving middleware ---
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] || '/'
        const accept = req.headers.accept || ''
        const config = getConfig()

        const isAsset =
          /\.(js|css|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|otf|mp4|webm|ogg|mp3|wav|flac|aac|pdf|zip|gz|map|json)$/i.test(
            url,
          )

        if (accept.includes('text/html') && !isAsset) {
          let html = getHtmlTemplate(config)
          html = injectHtmlMeta(html, config)
          html = await server.transformIndexHtml(req.url || '/', html)
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
          return
        }

        next()
      })

      // --- File watching setup ---
      const configPaths = CONFIG_FILES.map((c) =>
        path.resolve(process.cwd(), c),
      )
      const compExtensions = ['tsx', 'jsx']
      const layoutCompPaths = compExtensions.map((ext) =>
        path.resolve(docsDir, `layout.${ext}`),
      )
      const mdxCompExtensions = ['tsx', 'ts', 'jsx', 'js']
      const mdxCompPaths = mdxCompExtensions.map((ext) =>
        path.resolve(docsDir, `mdx-components.${ext}`),
      )
      const extPagesPaths = mdxCompExtensions.map((ext) =>
        path.resolve(docsDir, `pages-external/index.${ext}`),
      )
      const iconsPaths = mdxCompExtensions.map((ext) =>
        path.resolve(docsDir, `icons.${ext}`),
      )

      server.watcher.add([
        ...configPaths,
        ...mdxCompPaths,
        ...layoutCompPaths,
        ...extPagesPaths,
        ...iconsPaths,
      ])

      // --- HMR event handler ---
      const handleFileEvent = async (
        file: string,
        type: 'add' | 'unlink' | 'change',
      ) => {
        try {
          const normalized = normalizePath(file)

          // Config change → restart server
          if (CONFIG_FILES.some((c) => normalized.endsWith(c))) {
            server.restart()
            return
          }

          // mdx-components change → invalidate virtual module + regenerate types + full-reload
          if (
            mdxCompExtensions.some((ext) =>
              normalized.endsWith(`mdx-components.${ext}`),
            )
          ) {
            const currentConfig = getConfig()
            generateProjectTypes(currentConfig, docsDir)
            invalidateVirtualModule(server, 'mdx-components.tsx')
            server.ws.send({ type: 'full-reload' })
            return
          }

          // Icons change → invalidate virtual module + full-reload
          if (
            mdxCompExtensions.some((ext) => normalized.endsWith(`icons.${ext}`))
          ) {
            invalidateVirtualModule(server, 'icons.tsx')
            server.ws.send({ type: 'full-reload' })
            return
          }

          // Layout change → invalidate virtual module + full-reload
          if (
            normalized.endsWith('layout.tsx') ||
            normalized.endsWith('layout.jsx')
          ) {
            invalidateVirtualModule(server, 'layout.tsx')
            server.ws.send({ type: 'full-reload' })
            return
          }

          // External pages change → invalidate entry + full-reload
          if (
            normalized.includes('/pages-external/') ||
            normalized.includes('\\pages-external\\')
          ) {
            invalidateVirtualModule(server, 'entry')
            server.ws.send({ type: 'full-reload' })
            return
          }

          // Only process doc files inside docsDir (case-insensitive for Windows compatibility)
          const isInsideDocs = normalized
            .toLowerCase()
            .startsWith(normalizedDocsDir.toLowerCase())
          if (!isInsideDocs || !isDocFile(normalized)) return

          // ===== STRUCTURAL CHANGES (add/unlink) → full-reload =====
          if (type === 'add' || type === 'unlink') {
            if (type === 'unlink') {
              removeFrontmatterHash(file)
            }
            invalidateRouteCache()
            invalidateDirectoryMetaCache()

            // Reuse the existing in-memory config — boltdocs.config.ts did NOT change,
            // only a doc file was added/removed. Re-parsing the config file would call
            // Vite's loadConfigFromFile unnecessarily. Only re-generate project types
            // (fast, synchronous) so editor autocompletion stays up to date.
            const currentConfig = getConfig()
            generateProjectTypes(currentConfig, docsDir)

            invalidateVirtualModule(server, 'config')
            invalidateVirtualModule(server, 'routes')
            invalidateVirtualModule(server, 'search')

            // Update Link Tree on structural change (non-blocking)
            generateLinkTree(docsDir, process.cwd(), currentConfig).catch(
              (e) => {
                error('Failed to update link tree:', e)
              },
            )

            server.ws.send({
              type: 'custom',
              event: 'boltdocs:config-update',
              data: {
                theme: currentConfig?.theme,
                i18n: currentConfig?.i18n,
                versions: currentConfig?.versions,
                siteUrl: currentConfig?.siteUrl,
              },
            })
            server.ws.send({ type: 'full-reload' })
            return
          }

          // ===== CONTENT CHANGES (change) → granular HMR =====
          // Debounce rapid changes
          if (pendingChanges.has(normalized)) {
            clearTimeout(pendingChanges.get(normalized)!)
          }

          pendingChanges.set(
            normalized,
            setTimeout(async () => {
              pendingChanges.delete(normalized)

              try {
                // Check if frontmatter changed (async — non-blocking read)
                const prevHash = getFrontmatterHash(file)
                const newHash = await computeFrontmatterHash(file)
                setFrontmatterHash(file, newHash)

                // Invalidate file-level route cache
                invalidateFile(file)

                // Frontmatter changed → route metadata may have changed
                if (prevHash !== undefined && prevHash !== newHash) {
                  invalidateVirtualModule(server, 'routes')
                  invalidateVirtualModule(server, 'search')
                }

                // Send MDX update event to client with relative path for matching.
                // The client's create-routes.tsx listens for this to re-import
                // the updated module without a full page reload.
                const relative = path.relative(docsDir, file)
                const relPath = normalizePath(relative)

                // Invalidate the module in Vite's graph so the next request
                // for this file triggers a fresh transform (re-runs the MDX compiler).
                const mods = server.moduleGraph.getModulesByFile(normalized)
                if (mods) {
                  for (const mod of mods) {
                    server.moduleGraph.invalidateModule(mod)
                  }
                }

                server.ws.send({
                  type: 'custom',
                  event: 'boltdocs:mdx-update',
                  data: { file: normalized, relPath },
                })
              } catch (e) {
                error('HMR error processing content change:', e)
              }
            }, DEBOUNCE_MS),
          )
        } catch (e) {
          error(`HMR error during ${type} event:`, e)
        }
      }

      server.watcher.on('add', (f) => handleFileEvent(f, 'add'))
      server.watcher.on('unlink', (f) => handleFileEvent(f, 'unlink'))
      server.watcher.on('change', (f) => handleFileEvent(f, 'change'))

      await lifecycle?.runHook('afterDev')
    },

    /**
     * Intercept Vite's HMR graph propagation for MDX/MD files.
     *
     * When a .md/.mdx file inside docsDir changes, Vite would normally walk
     * the import graph upwards, reach the virtual entry module (which has no
     * HMR boundary), and trigger a full page reload.
     *
     * By returning an EMPTY array here, we tell Vite: "I will handle this
     * update myself — do not send any HMR or reload messages."
     * The actual update is sent as a custom 'boltdocs:mdx-update' WS event
     * from the watcher handler above, which the client handles gracefully.
     */
    handleHotUpdate({ file, server: s }) {
      const normalized = normalizePath(file)
      const isInsideDocs = normalized
        .toLowerCase()
        .startsWith(normalizedDocsDir.toLowerCase())
      if (isInsideDocs && isDocFile(normalized)) {
        // Returning empty array: we own this update, Vite does nothing.
        return []
      }
    },
  }
}
