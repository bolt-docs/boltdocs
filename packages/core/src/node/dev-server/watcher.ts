import type { ViteDevServer } from 'vite'
import path from 'node:path'
import { CONFIG_FILES } from '../config'

const COMP_EXTENSIONS = ['tsx', 'jsx']
const MDX_COMP_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js']

export function configureWatcher(server: ViteDevServer, docsDir: string): void {
  const configPaths = CONFIG_FILES.map((c) => path.resolve(process.cwd(), c))
  const layoutCompPaths = COMP_EXTENSIONS.map((ext) =>
    path.resolve(docsDir, `layout.${ext}`),
  )
  const mdxCompPaths = MDX_COMP_EXTENSIONS.map((ext) =>
    path.resolve(docsDir, `mdx-components.${ext}`),
  )
  const extPagesPaths = MDX_COMP_EXTENSIONS.map((ext) =>
    path.resolve(docsDir, `pages-external/index.${ext}`),
  )
  const iconsPaths = MDX_COMP_EXTENSIONS.map((ext) =>
    path.resolve(docsDir, `icons.${ext}`),
  )

  server.watcher.add([
    ...configPaths,
    ...mdxCompPaths,
    ...layoutCompPaths,
    ...extPagesPaths,
    ...iconsPaths,
  ])
}
