import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import sassPlugin from '../src/node/index'

async function createFixture(files: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'boltdocs-sass-'))
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

describe('Sass plugin Vite integration', () => {
  it('compiles SCSS with additionalData and modern loadPaths', async () => {
    const root = await createFixture({
      'src/styles/_tokens.scss': '$brand: #123456;\n',
      'src/main.scss': '.card { color: $brand; padding: 4px; }\n',
      'index.html':
        '<div class="card">hello</div><script type="module" src="/src/main.scss"></script>',
    })
    try {
      const plugin = sassPlugin({
        api: 'modern',
        loadPaths: [path.join(root, 'src/styles')],
        additionalData: '@use "tokens" as *;\n',
      })
      await build({
        root,
        logLevel: 'error',
        css: plugin.css as unknown as Parameters<
          typeof build
        >[0] extends infer T
          ? T extends { css?: infer C }
            ? C
            : never
          : never,
        build: { outDir: path.join(root, 'dist') },
      })
      const output = (await readCss(root)).join('\n')
      expect(output).toContain('.card')
      expect(output).toContain('#123456')
      expect(output).toContain('padding:4px')
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
