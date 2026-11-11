import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import lightningcssPlugin from '../src/node/index'

async function createFixture(files: Record<string, string>) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'boltdocs-lightningcss-'),
  )
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

describe('Lightning CSS plugin Vite integration', () => {
  it('transforms modern CSS features in a production build', async () => {
    const root = await createFixture({
      'src/main.css': `
        @custom-media --small (width >= 600px);
        .card {
          color: oklch(0.7 0.1 200);
          & .title { font-weight: 700; }
        }
        @media (--small) {
          .card { padding: 1rem; }
        }
      `,
      'index.html':
        '<div class="card"><span class="title">hello</span></div><script type="module" src="/src/main.css"></script>',
    })
    try {
      const plugin = lightningcssPlugin({ drafts: { customMedia: true } })
      await build({
        root,
        logLevel: 'error',
        plugins: plugin.vitePlugins as never,
        build: {
          outDir: path.join(root, 'dist'),
          cssMinify: 'lightningcss',
        },
      })
      const output = (await readCss(root)).join('\n')
      // Lightning CSS lowers/transforms nesting and custom media in output
      expect(output).toContain('.card')
      expect(output).toContain('.title')
      expect(output).toContain('font-weight')
      expect(output).toMatch(/@media|padding/)
      expect(output).not.toContain('@custom-media')
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
