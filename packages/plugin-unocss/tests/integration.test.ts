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
})
