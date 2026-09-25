import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import unocssPlugin from '../src/node/index'

async function createFixture(files: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'boltdocs-unocss-'))
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content)
  }
  return root
}

async function readCss(root: string) {
  const assets = path.join(root, 'dist', 'assets')
  const files = await fs.readdir(assets)
  const cssFiles = files.filter((file) => file.endsWith('.css'))
  return Promise.all(
    cssFiles.map((file) => fs.readFile(path.join(assets, file), 'utf8')),
  )
}

describe('UnoCSS plugin Vite integration', () => {
  it('supports the Vite generation modes', () => {
    for (const mode of [
      'global',
      'per-module',
      'vue-scoped',
      'dist-chunk',
      'shadow-dom',
    ] as const) {
      expect(unocssPlugin({ mode }).vitePlugins).toHaveLength(1)
    }
  })

  it('generates atomic utilities with Vite 8/Rolldown', async () => {
    const root = await createFixture({
      'src/main.ts': "import 'virtual:uno.css'\n",
      'index.html':
        '<div class="text-red-500 font-bold">hello</div><script type="module" src="/src/main.ts"></script>',
    })
    try {
      const plugin = unocssPlugin()
      await build({
        root,
        logLevel: 'error',
        plugins: plugin.vitePlugins as never,
        build: { outDir: path.join(root, 'dist') },
      })
      const output = (await readCss(root)).join('\n')
      expect(output).toContain('.text-red-500')
      expect(output).toContain('.font-bold')
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('extracts utilities from documentation sources', async () => {
    const root = await createFixture({
      'docs/guide.mdx': '# Guide\n\n<div class="text-blue-500">guide</div>\n',
      'src/main.ts': "import 'virtual:uno.css'\n",
      'index.html': '<script type="module" src="/src/main.ts"></script>',
    })
    try {
      const plugin = unocssPlugin()
      await build({
        root,
        logLevel: 'error',
        plugins: plugin.vitePlugins as never,
        build: { outDir: path.join(root, 'dist') },
      })
      const output = (await readCss(root)).join('\n')
      expect(output).toContain('.text-blue-500')
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('supports a custom docs directory and Vite modes', async () => {
    const root = await createFixture({
      'content/docs/guide.mdx':
        '# Guide\n\n<div class="text-green-500">guide</div>\n',
      'src/main.ts': "import 'virtual:uno.css'\n",
      'index.html': '<script type="module" src="/src/main.ts"></script>',
    })
    try {
      const plugin = unocssPlugin({
        docsDir: 'content/docs',
        mode: 'global',
      })
      await build({
        root,
        logLevel: 'error',
        plugins: plugin.vitePlugins as never,
        build: { outDir: path.join(root, 'dist') },
      })
      const output = (await readCss(root)).join('\n')
      expect(output).toContain('.text-green-500')
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
