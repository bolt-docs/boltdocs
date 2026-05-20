import type { Plugin, ResolvedConfig } from 'vite'
import { generateRoutes } from '../routes'
import { adaptRoutesForSSG } from '../routes/route-adapter'
import { normalizePath } from '../utils'
import { generateSearchData } from '../search'
import type { BoltdocsConfig } from '../config'
import type { BoltdocsPluginOptions } from './types'
import { generateEntryCode } from './entry'
import path from 'node:path'
import fs from 'node:fs'

// ---------------------------------------------------------------------------
// Directory Meta Cache (Fix #5)
// loadDirectoryMeta runs an fdir crawl on every request, which is expensive.
// Cache the result in memory; it is invalidated on add/unlink of docs files
// so stale data is never returned after a structural change.
// ---------------------------------------------------------------------------
let _directoryMetaCache: Record<string, any> | null = null
let _searchDataCache: string | null = null

/**
 * Called by the dev-server watcher whenever a file is added or removed
 * so that the next config module request re-crawls for meta.json files.
 */
export function invalidateDirectoryMetaCache(): void {
  _directoryMetaCache = null
  _searchDataCache = null
}

/**
 * Creates the Vite plugin responsible for resolving and loading all
 * `virtual:boltdocs-*` modules. These virtual modules provide route data,
 * configuration, MDX components, layouts, and search data to the client.
 */
export function createVirtualModulesPlugin(
  options: BoltdocsPluginOptions,
  getConfig: () => BoltdocsConfig,
  getViteConfig: () => ResolvedConfig | undefined,
  docsDir: string,
): Plugin {
  return {
    name: 'vite-plugin-boltdocs-virtual-modules',

    resolveId(id) {
      const viteConfig = getViteConfig()
      const root = viteConfig?.root || process.cwd()
      if (
        id.includes('boltdocs-entry.tsx') ||
        id === 'virtual:boltdocs-entry' ||
        id === 'boltdocs-entry' ||
        id === '\0virtual:boltdocs-entry'
      ) {
        return normalizePath(path.resolve(root, 'boltdocs-entry.tsx'))
      }
      if (
        id.includes('boltdocs-client.mjs') ||
        id === 'virtual:boltdocs-client' ||
        id === 'boltdocs-client' ||
        id === '\0virtual:boltdocs-client.ts'
      ) {
        return normalizePath(path.resolve(root, 'boltdocs-client.mjs'))
      }

      if (id.startsWith('virtual:boltdocs-')) {
        return '\0' + id
      }
      if (id.startsWith('\0virtual:boltdocs-')) {
        return id
      }

      return null
    },

    async load(id) {
      const viteConfig = getViteConfig()
      const isBuild = viteConfig?.command === 'build'
      const config = getConfig()

      if (
        id.includes('boltdocs-entry.tsx') ||
        id === '\0virtual:boltdocs-entry'
      ) {
        return generateEntryCode(options, config, isBuild)
      }

      if (
        id.includes('boltdocs-client.mjs') ||
        id === '\0virtual:boltdocs-client.ts' ||
        id === 'virtual:boltdocs-client'
      ) {
        let currentDir = __dirname
        let packageRoot = currentDir
        while (currentDir !== path.parse(currentDir).root) {
          if (fs.existsSync(path.join(currentDir, 'package.json'))) {
            const pkg = JSON.parse(
              fs.readFileSync(path.join(currentDir, 'package.json'), 'utf-8'),
            )
            if (pkg.name === 'boltdocs') {
              packageRoot = currentDir
              break
            }
          }
          currentDir = path.dirname(currentDir)
        }

        const srcPath = path.join(packageRoot, 'src/client/index.ts')
        const distPath = path.join(packageRoot, 'dist/client/index.js')

        const filePath = fs.existsSync(srcPath) ? srcPath : distPath
        const normalized = normalizePath(filePath)
        return `export * from '${normalized}';`
      }

      if (!id.startsWith('\0virtual:boltdocs-')) return

      const nameWithExt = id.replace('\0virtual:boltdocs-', '')
      const name = nameWithExt.replace(/\.tsx?$/, '')

      if (name === 'routes') {
        const routes = await generateRoutes(docsDir, config)
        const ssgRoutes = adaptRoutesForSSG(routes)
        return `export default ${JSON.stringify(ssgRoutes, null, 2)};`
      }
      if (name === 'config') {
        // Use cached directory meta to avoid a full fdir crawl on every request.
        // The cache is invalidated by the dev-server watcher on add/unlink events.
        if (_directoryMetaCache === null) {
          const { loadDirectoryMeta } = await import('../routes/meta-loader')
          _directoryMetaCache = await loadDirectoryMeta(docsDir)
        }
        const directoryMeta = _directoryMetaCache
        const clientConfig = {
          base: config?.base,
          theme: config?.theme,
          i18n: config?.i18n,
          versions: config?.versions,
          siteUrl: config?.siteUrl,
          integrations: config?.integrations,
          plugins: config?.plugins?.map((p) => ({ name: p.name })),
          directoryMeta,
        }
        return `export default ${JSON.stringify(clientConfig, null, 2)};`
      }
      if (name === 'entry') {
        const code = generateEntryCode(options, config, isBuild)
        return code
      }
      if (name === 'mdx-components') {
        const extensions = ['tsx', 'ts', 'jsx', 'js']
        let userMdxPath = null

        for (const ext of extensions) {
          const p = path.resolve(docsDir, `mdx-components.${ext}`)
          if (fs.existsSync(p)) {
            userMdxPath = p
            break
          }
        }

        if (userMdxPath) {
          const normalizedPath = normalizePath(userMdxPath)
          return `import * as components from '${normalizedPath}';
const mdxComponents = components.default || components;
export default mdxComponents;
export * from '${normalizedPath}';`
        }

        return `export default {};`
      }
      if (name === 'layout') {
        const extensions = ['tsx', 'jsx']
        let userLayoutPath = null

        for (const ext of extensions) {
          const p = path.resolve(docsDir, `layout.${ext}`)
          if (fs.existsSync(p)) {
            userLayoutPath = p
            break
          }
        }

        if (userLayoutPath) {
          const normalizedPath = normalizePath(userLayoutPath)
          return `import UserLayout from '${normalizedPath}';
export default UserLayout;`
        }

        throw new Error(
          `[Boltdocs] Layout file not found. A 'layout.tsx' or 'layout.jsx' file is mandatory in your docs directory. Please create one to define your site structure.`,
        )
      }

      if (name === 'icons') {
        const extensions = ['tsx', 'jsx', 'ts', 'js']
        let userIconsPath = null

        for (const ext of extensions) {
          const p = path.resolve(docsDir, `icons.${ext}`)
          if (fs.existsSync(p)) {
            userIconsPath = p
            break
          }
        }

        if (userIconsPath) {
          const normalizedPath = normalizePath(userIconsPath)
          return `import * as icons from '${normalizedPath}';\nexport default icons;`
        }

        return `export default {};`
      }

      if (name === 'search') {
        if (!_searchDataCache) {
          const routes = await generateRoutes(docsDir, config)
          const searchData = generateSearchData(routes)
          _searchDataCache = `export default ${JSON.stringify(searchData, null, 2)};`
        }
        return _searchDataCache
      }

      if (name === 'client') {
        let currentDir = __dirname
        let clientPath = ''

        while (currentDir && currentDir !== path.parse(currentDir).root) {
          const srcPath = path.join(currentDir, 'src/client/index.ts')
          const distPath = path.join(currentDir, 'dist/client/index.mjs')
          const directPath = path.join(currentDir, 'client/index.ts')

          if (fs.existsSync(srcPath)) {
            clientPath = normalizePath(srcPath)
            break
          }
          if (fs.existsSync(distPath)) {
            clientPath = normalizePath(distPath)
            break
          }
          if (fs.existsSync(directPath)) {
            clientPath = normalizePath(directPath)
            break
          }
          currentDir = path.dirname(currentDir)
        }

        if (!clientPath) {
          throw new Error(
            `[boltdocs] Could not resolve boltdocs/client entry point starting from ${__dirname}`,
          )
        }

        return `export * from '${clientPath}';`
      }
    },
  }
}
