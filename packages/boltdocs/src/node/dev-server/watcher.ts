import type { ViteDevServer } from 'vite'
import path from 'node:path'
import { CONFIG_FILES } from '../config'

const COMP_EXTENSIONS = ['tsx', 'jsx']
const MDX_COMP_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js']

/**
 * Extends the Vite file watcher to paths that live outside the server root.
 *
 * The Vite watcher already recursively watches the entire project root, so
 * paths inside it (config, layout, mdx-components, icons, pages-external, …)
 * are covered by the initial scan. Explicitly calling `watcher.add()` for
 * those paths would race with chokidar's initial recursive scan: adding a
 * file inside a directory the scan has not visited yet registers that
 * directory as "already tracked", so the scan skips recursing into it and
 * every other file in it (e.g. `pages-external/roadmap.mdx` or
 * `pages-external/_sections/*`) is never watched — breaking HMR for those
 * files. Only paths outside the root need to be added explicitly.
 */
export function configureWatcher(server: ViteDevServer, docsDir: string): void {
  const root = path.resolve(server.config.root)
  const isInsideRoot = (p: string): boolean => {
    const resolved = path.resolve(p)
    return resolved === root || resolved.startsWith(`${root}${path.sep}`)
  }

  const candidatePaths = [
    ...CONFIG_FILES.map((c) => path.resolve(process.cwd(), c)),
    ...COMP_EXTENSIONS.map((ext) => path.resolve(docsDir, `layout.${ext}`)),
    ...MDX_COMP_EXTENSIONS.map((ext) =>
      path.resolve(docsDir, `mdx-components.${ext}`),
    ),
    ...MDX_COMP_EXTENSIONS.map((ext) =>
      path.resolve(docsDir, `pages-external/index.${ext}`),
    ),
    ...MDX_COMP_EXTENSIONS.map((ext) => path.resolve(docsDir, `icons.${ext}`)),
  ]

  const externalPaths = candidatePaths.filter((p) => !isInsideRoot(p))
  if (externalPaths.length > 0) {
    server.watcher.add(externalPaths)
  }
}
