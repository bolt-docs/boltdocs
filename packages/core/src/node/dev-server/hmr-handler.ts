import type { ViteDevServer, Plugin } from 'vite'
import { invalidateRouteCache, invalidateFile } from '../routes'
import { type BoltdocsConfig, CONFIG_FILES } from '../config'
import { generateProjectTypes } from '../types-generator'
import { normalizePath, isDocFile } from '../utils'
import {
  computeFrontmatterDelta,
  invalidateDirectoryMetaCache,
} from '../plugin/virtual-modules'
import {
  invalidateVirtualModulesCache,
  runPluginHmrHandlers,
} from '../plugins/plugin-context'
import {
  computeFrontmatterHash,
  getFrontmatterHash,
  setFrontmatterHash,
  removeFrontmatterHash,
} from './frontmatter-cache'
import { generateLinkTree } from '../cli/doctor'
import path from 'node:path'
import { error } from '@bdocs/dui'
import { invalidateMdxFileCache } from '@bdocs/processor-satteri/node'

const DEBOUNCE_MS = 150
const MDX_COMP_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js']

function invalidateVirtualModule(server: ViteDevServer, name: string): void {
  const mod = server.moduleGraph.getModuleById(`\0virtual:boltdocs-${name}.ts`)
  if (mod) server.moduleGraph.invalidateModule(mod)
}

export function setupHmr(
  server: ViteDevServer,
  docsDir: string,
  normalizedDocsDir: string,
  getConfig: () => BoltdocsConfig,
): void {
  const pendingChanges = new Map<string, ReturnType<typeof setTimeout>>()
  const lowerDocsDir = normalizedDocsDir.toLowerCase()
  // Pre-built lowercase index for O(1) module graph fallback lookup
  let lowerModuleIndex: Map<string, any> | null = null

  function getLowerModuleIndex(): Map<string, any> {
    if (lowerModuleIndex) return lowerModuleIndex
    lowerModuleIndex = new Map()
    for (const [key, value] of server.moduleGraph.fileToModulesMap.entries()) {
      try {
        lowerModuleIndex.set(decodeURIComponent(key).toLowerCase(), value)
      } catch {}
    }
    return lowerModuleIndex
  }

  // Invalidate the lowercase index when the module graph changes
  server.watcher.on('all', () => {
    lowerModuleIndex = null
  })

  function invalidateMdxModules(normalized: string): boolean {
    let mods = server.moduleGraph.getModulesByFile(normalized)
    if (!mods || mods.size === 0) {
      mods = getLowerModuleIndex().get(normalized.toLowerCase()) || null
    }
    if (mods && mods.size > 0) {
      for (const mod of mods) {
        server.moduleGraph.invalidateModule(mod)
      }
      return true
    }
    return false
  }

  function sendMdxContentUpdate(file: string, normalized: string): void {
    const relative = path.relative(docsDir, file)
    const relPath = normalizePath(relative)
    const found = invalidateMdxModules(normalized)
    if (found) {
      server.ws.send({
        type: 'custom',
        event: 'boltdocs:mdx-update',
        data: { file: normalized, relPath },
      })
    } else {
      server.ws.send({ type: 'full-reload' })
    }
  }

  const handleFileEvent = async (
    file: string,
    type: 'add' | 'unlink' | 'change',
  ) => {
    try {
      const normalized = normalizePath(file)

      if (CONFIG_FILES.some((c) => normalized.endsWith(c))) {
        server.restart()
        return
      }

      if (
        MDX_COMP_EXTENSIONS.some((ext) =>
          normalized.endsWith(`mdx-components.${ext}`),
        )
      ) {
        const currentConfig = getConfig()
        generateProjectTypes(currentConfig, docsDir)
        invalidateVirtualModule(server, 'mdx-components.tsx')
        server.ws.send({ type: 'full-reload' })
        return
      }

      if (
        MDX_COMP_EXTENSIONS.some((ext) => normalized.endsWith(`icons.${ext}`))
      ) {
        invalidateVirtualModule(server, 'icons.tsx')
        server.ws.send({ type: 'full-reload' })
        return
      }

      if (
        normalized.endsWith('layout.tsx') ||
        normalized.endsWith('layout.jsx')
      ) {
        invalidateVirtualModule(server, 'layout.tsx')
        server.ws.send({ type: 'full-reload' })
        return
      }

      if (
        normalized.endsWith('/post.tsx') ||
        normalized.endsWith('/post.jsx') ||
        normalized.endsWith('/list.tsx') ||
        normalized.endsWith('/list.jsx')
      ) {
        invalidateVirtualModule(server, 'entry')
        server.ws.send({ type: 'full-reload' })
        return
      }

      if (
        normalized.includes('/pages-external/') ||
        normalized.includes('\\pages-external\\')
      ) {
        invalidateVirtualModule(server, 'entry')
        server.ws.send({ type: 'full-reload' })
        return
      }

      const isInsideDocs = normalized.toLowerCase().startsWith(lowerDocsDir)
      if (!isInsideDocs) return

      const isMetaJson =
        normalized.endsWith('meta.json') || normalized.endsWith('_meta.json')
      if (!isMetaJson && !isDocFile(normalized)) return

      if (type === 'add' || type === 'unlink' || isMetaJson) {
        if (type === 'unlink') {
          removeFrontmatterHash(file)
        }
        invalidateRouteCache()
        invalidateDirectoryMetaCache()
        invalidateVirtualModulesCache()

        // Notify plugin HMR handlers after core processing
        runPluginHmrHandlers(type, normalized).catch((e) => {
          error('Plugin HMR handler error:', e)
        })

        const currentConfig = getConfig()
        generateProjectTypes(currentConfig, docsDir)

        invalidateVirtualModule(server, 'config')
        invalidateVirtualModule(server, 'routes')
        invalidateVirtualModule(server, 'search')
        invalidateVirtualModule(server, 'collections')

        generateLinkTree(docsDir, process.cwd(), currentConfig).catch((e) => {
          error('Failed to update link tree:', e)
        })

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

      if (pendingChanges.has(normalized)) {
        clearTimeout(pendingChanges.get(normalized)!)
      }

      pendingChanges.set(
        normalized,
        setTimeout(async () => {
          pendingChanges.delete(normalized)

          try {
            const prevHash = getFrontmatterHash(file)
            const newHash = await computeFrontmatterHash(file)
            setFrontmatterHash(file, newHash)

            invalidateFile(file)
            invalidateMdxFileCache(file)

            if (prevHash !== undefined && prevHash !== newHash) {
              invalidateVirtualModule(server, 'routes')
              invalidateVirtualModule(server, 'search')
              invalidateVirtualModule(server, 'collections')

              const currentConfig = getConfig()

              try {
                const delta = await computeFrontmatterDelta(
                  docsDir,
                  currentConfig,
                )
                // Structural changes (route deletions) still require a full
                // reload because React Router's route tree is built from the
                // static virtual module entry point.
                if (delta.routes.deleted.length > 0) {
                  server.ws.send({ type: 'full-reload' })
                  return
                }

                server.ws.send({
                  type: 'custom',
                  event: 'boltdocs:frontmatter-update',
                  data: delta,
                })
              } catch (e) {
                error('Failed to compute frontmatter delta:', e)
                server.ws.send({ type: 'full-reload' })
                return
              }

              // Frontmatter-only changes may also include body edits; send the
              // same content HMR event so the page module re-renders without
              // requiring a separate save cycle.
              sendMdxContentUpdate(file, normalized)
              return
            }

            sendMdxContentUpdate(file, normalized)
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
}

export function createHotUpdateHandler(
  normalizedDocsDir: string,
): Plugin['hotUpdate'] {
  const lowerDocsDir = normalizedDocsDir.toLowerCase()
  return ({ file }) => {
    const normalized = file.toLowerCase()
    if (
      normalized.startsWith(lowerDocsDir) &&
      (isDocFile(file) || normalized.endsWith('meta.json'))
    ) {
      return []
    }
  }
}
