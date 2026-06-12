import type { ViteDevServer, Plugin } from 'vite'
import { invalidateRouteCache, invalidateFile } from '../routes'
import { type BoltdocsConfig, CONFIG_FILES } from '../config'
import { generateProjectTypes } from '../types-generator'
import { normalizePath, isDocFile } from '../utils'
import { invalidateDirectoryMetaCache } from '../plugin/virtual-modules'
import {
  computeFrontmatterHash,
  getFrontmatterHash,
  setFrontmatterHash,
  removeFrontmatterHash,
} from './frontmatter-cache'
import { generateLinkTree } from '../cli/doctor'
import path from 'node:path'
import { error } from '@bdocs/dui'

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

            if (prevHash !== undefined && prevHash !== newHash) {
              invalidateVirtualModule(server, 'routes')
              invalidateVirtualModule(server, 'search')
              invalidateVirtualModule(server, 'collections')
              server.ws.send({ type: 'full-reload' })
              return
            }

            const relative = path.relative(docsDir, file)
            const relPath = normalizePath(relative)

            const mods = server.moduleGraph.getModulesByFile(normalized)
            if (mods && mods.size > 0) {
              for (const mod of mods) {
                server.moduleGraph.invalidateModule(mod)
              }
            } else {
              server.ws.send({ type: 'full-reload' })
              return
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
