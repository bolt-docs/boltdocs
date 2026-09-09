import type { ModuleNode, ViteDevServer, Plugin } from 'vite'
import { invalidateRouteCache, invalidateFile } from '../routes'
import {
  getRouteGenerationFingerprint,
  getRouteCacheContext,
  getRouteCacheVariant,
  invalidateDirectoryMetaFile,
  type RouteCacheContext,
  type RouteCacheVariant,
} from '../routes/cache'
import { type BoltdocsConfig, CONFIG_FILES } from '../config'
import { generateProjectTypes } from '../types-generator'
import { normalizePath, isDocFile } from '../utils'
import {
  computeFrontmatterDelta,
  invalidateDirectoryMetaCache,
  type VirtualModuleState,
} from '../plugin/virtual-modules'
import {
  runPluginHmrHandlers,
  type PluginRuntimeState,
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
  // The entry resolves with a `.tsx` extension while other virtual modules use
  // `.ts`; probe the exact id so invalidation actually hits the module graph.
  const candidates = [
    `\0virtual:boltdocs-${name}.ts`,
    `\0virtual:boltdocs-${name}.tsx`,
  ]
  for (const id of candidates) {
    const mod = server.moduleGraph.getModuleById(id)
    if (mod) {
      server.moduleGraph.invalidateModule(mod)
      break
    }
  }
}

export function setupHmr(
  server: ViteDevServer,
  docsDir: string,
  normalizedDocsDir: string,
  getConfig: () => BoltdocsConfig,
  runtime?: PluginRuntimeState,
  virtualModuleState?: VirtualModuleState,
  routeCacheContext?: RouteCacheContext,
  routeCacheVariant?: RouteCacheVariant,
): void {
  const cacheContext =
    routeCacheContext && !routeCacheContext.disposed
      ? routeCacheContext
      : virtualModuleState?.routeCacheContext &&
          !virtualModuleState.routeCacheContext.disposed
        ? virtualModuleState.routeCacheContext
        : getRouteCacheContext(docsDir)
  const cacheVariant =
    routeCacheVariant ??
    getRouteCacheVariant(
      cacheContext,
      getRouteGenerationFingerprint(getConfig()),
    )
  const pendingChanges = new Map<string, ReturnType<typeof setTimeout>>()
  const changeQueues = new Map<string, Promise<void>>()
  const fileGenerations = new Map<string, number>()
  const lowerDocsDir = normalizedDocsDir.replace(/\/+$/, '').toLowerCase()
  // Pre-built lowercase index for O(1) module graph fallback lookup
  let lowerModuleIndex: Map<string, Set<ModuleNode>> | null = null

  function getLowerModuleIndex(): Map<string, Set<ModuleNode>> {
    if (lowerModuleIndex) return lowerModuleIndex
    lowerModuleIndex = new Map()
    for (const [key, value] of server.moduleGraph.fileToModulesMap.entries()) {
      try {
        if (value) {
          lowerModuleIndex.set(decodeURIComponent(key).toLowerCase(), value)
        }
      } catch {}
    }
    return lowerModuleIndex
  }

  // Invalidate the lowercase index when the module graph changes
  server.watcher.on('all', () => {
    lowerModuleIndex = null
  })

  function isCurrentGeneration(file: string, generation: number): boolean {
    return fileGenerations.get(file) === generation
  }

  function invalidateMdxModules(normalized: string): boolean {
    let mods = server.moduleGraph.getModulesByFile(normalized)
    if (!mods || mods.size === 0) {
      mods = getLowerModuleIndex().get(normalized.toLowerCase())
    }
    if (mods && mods.size > 0) {
      for (const mod of mods) {
        server.moduleGraph.invalidateModule(mod)
      }
      return true
    }
    return false
  }

  function sendMdxContentUpdate(
    file: string,
    normalized: string,
    generation: number,
  ): void {
    if (!isCurrentGeneration(normalized, generation)) return

    const relative = path.relative(docsDir, file)
    const relPath = normalizePath(relative)
    const found = invalidateMdxModules(normalized)
    if (!isCurrentGeneration(normalized, generation)) return
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
      const generation = (fileGenerations.get(normalized) ?? 0) + 1
      fileGenerations.set(normalized, generation)

      if (type === 'add' || type === 'unlink') {
        const pending = pendingChanges.get(normalized)
        if (pending) {
          clearTimeout(pending)
          pendingChanges.delete(normalized)
        }
      }

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

      const lowerNormalized = normalized.toLowerCase()
      const isInsideDocs =
        lowerNormalized === lowerDocsDir ||
        lowerNormalized.startsWith(`${lowerDocsDir}/`)
      if (!isInsideDocs) return

      const isMetaJson =
        normalized.endsWith('meta.json') || normalized.endsWith('_meta.json')
      if (!isMetaJson && !isDocFile(normalized)) return

      if (type === 'add' || type === 'unlink' || isMetaJson) {
        if (type === 'unlink') {
          removeFrontmatterHash(file, cacheContext, cacheVariant)
        }
        if (isMetaJson) {
          invalidateDirectoryMetaFile(file, cacheContext)
        }
        // A deleted-and-recreated file keeps its old compiled output in the
        // Sätteri MDX cache and in Vite's module graph unless it is
        // invalidated here: the `change` path below clears both, but `add`
        // regenerates routes and sends a full reload, after which the
        // browser re-fetches the module and would otherwise receive the
        // stale compiled content. (`unlink` alone needs no invalidation:
        // the file is gone, and a later re-add goes through this branch.)
        if (type === 'add') {
          invalidateMdxFileCache(file)
          invalidateMdxModules(normalized)
        }
        invalidateRouteCache(cacheContext)
        invalidateDirectoryMetaCache(virtualModuleState)

        // Notify plugin HMR handlers after core processing. Preserve the
        // two-argument legacy call for isolated consumers that do not provide
        // an explicit runtime.
        const hmrResult = runtime
          ? runPluginHmrHandlers(type, normalized, runtime)
          : runPluginHmrHandlers(type, normalized)
        hmrResult.catch((e) => {
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
        const pending = pendingChanges.get(normalized)
        if (pending) clearTimeout(pending)
      }

      pendingChanges.set(
        normalized,
        setTimeout(() => {
          pendingChanges.delete(normalized)

          const previousChange =
            changeQueues.get(normalized) ?? Promise.resolve()
          const currentChange = previousChange.then(async () => {
            if (fileGenerations.get(normalized) !== generation) return

            try {
              const prevHash = getFrontmatterHash(
                file,
                cacheContext,
                cacheVariant,
              )
              const newHash = await computeFrontmatterHash(file)
              if (fileGenerations.get(normalized) !== generation) return

              if (!isCurrentGeneration(normalized, generation)) return

              // Invalidate the route/parser caches first, then persist the
              // new hash as the baseline for the next change. Storing before
              // invalidating would wipe the just-written entry (invalidateFile
              // clears frontmatterHashes), leaving prevHash undefined on the
              // next edit and silently disabling frontmatter-delta HMR.
              invalidateFile(file, cacheContext)
              invalidateMdxFileCache(file)
              setFrontmatterHash(file, newHash, cacheContext, cacheVariant)

              // Regular document changes are debounced below, so notify
              // plugin handlers here after the change has been validated and
              // the parser/MDX caches have been invalidated.
              if (runtime) {
                await runPluginHmrHandlers('change', normalized, runtime)
              } else {
                await runPluginHmrHandlers('change', normalized)
              }

              if (prevHash !== undefined && prevHash !== newHash) {
                if (!isCurrentGeneration(normalized, generation)) return

                invalidateVirtualModule(server, 'routes')
                invalidateVirtualModule(server, 'search')
                invalidateVirtualModule(server, 'collections')

                const currentConfig = getConfig()

                try {
                  const delta = await computeFrontmatterDelta(
                    docsDir,
                    currentConfig,
                    virtualModuleState,
                    cacheContext,
                    cacheVariant,
                  )
                  if (!isCurrentGeneration(normalized, generation)) return
                  // Structural changes (route deletions) still require a full
                  // reload because React Router's route tree is built from the
                  // static virtual module entry point.
                  if (delta.routes.deleted.length > 0) {
                    if (isCurrentGeneration(normalized, generation)) {
                      server.ws.send({ type: 'full-reload' })
                    }
                    return
                  }

                  if (!isCurrentGeneration(normalized, generation)) return
                  server.ws.send({
                    type: 'custom',
                    event: 'boltdocs:frontmatter-update',
                    data: delta,
                  })
                } catch (e) {
                  // Internal sentinel symbols (e.g. route-generation-invalidated)
                  // are expected under concurrent edits: the generation was
                  // superseded by a newer one. A full reload is the safe
                  // fallback and no error needs to be surfaced for it.
                  if (typeof e === 'symbol') {
                    if (isCurrentGeneration(normalized, generation)) {
                      server.ws.send({ type: 'full-reload' })
                    }
                    return
                  }
                  error('Failed to compute frontmatter delta:', e)
                  if (isCurrentGeneration(normalized, generation)) {
                    server.ws.send({ type: 'full-reload' })
                  }
                  return
                }

                // Frontmatter-only changes may also include body edits; send the
                // same content HMR event so the page module re-renders without
                // requiring a separate save cycle.
                sendMdxContentUpdate(file, normalized, generation)
                return
              }

              sendMdxContentUpdate(file, normalized, generation)
            } catch (e) {
              error('HMR error processing content change:', e)
            }
          })

          changeQueues.set(normalized, currentChange)
          const clearCurrentChange = () => {
            if (changeQueues.get(normalized) === currentChange) {
              changeQueues.delete(normalized)
            }
          }
          void currentChange.then(clearCurrentChange, clearCurrentChange)
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
  const lowerDocsDir = normalizePath(normalizedDocsDir)
    .replace(/\/+$/, '')
    .toLowerCase()
  return ({ file }) => {
    const normalized = normalizePath(file).toLowerCase()
    const isInsideDocs =
      normalized === lowerDocsDir || normalized.startsWith(`${lowerDocsDir}/`)
    const isExternalPage =
      normalized.includes('/pages-external/') ||
      normalized.includes('\\pages-external\\')
    if (
      isInsideDocs &&
      (isDocFile(file) || normalized.endsWith('meta.json') || isExternalPage)
    ) {
      // Suppress Vite's default module-graph HMR for docs content and
      // pages-external files — the watcher-driven handler owns their
      // reload/update so a single change produces a single reload instead
      // of a full-reload plus Vite's own full-reload.
      return []
    }
  }
}
