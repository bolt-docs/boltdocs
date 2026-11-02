import fs from 'fs-extra'
import crypto from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { collectPerformanceMetrics } from '../src/node/performance'

const roots: string[] = []

function makeRoot(): string {
  const root = join(tmpdir(), `boltdocs-performance-${crypto.randomUUID()}`)
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.remove(root)))
})

describe('collectPerformanceMetrics', () => {
  it('uses the supplied output inventory and external manifest', async () => {
    const root = makeRoot()
    const out = join(root, 'dist')
    const manifest = join(root, 'client-cache', '.vite', 'manifest.json')

    await fs.outputFile(join(out, 'index.html'), 'home')
    await fs.outputFile(join(out, 'docs', 'intro.html'), 'intro page')
    await fs.outputFile(join(out, 'assets', 'app.js'), 'console.log(1)')
    await fs.outputFile(join(out, 'assets', 'app.css'), 'body{}')
    await fs.outputJson(manifest, {
      app: { file: 'assets/app.js', css: ['assets/app.css'] },
    })

    const metrics = await collectPerformanceMetrics(out, 123, undefined, {
      outputFiles: [
        'index.html',
        'docs/intro.html',
        'assets/app.js',
        'assets/app.css',
      ],
      manifestPath: manifest,
    })

    expect(metrics.buildTime).toBe(123)
    expect(metrics.totalJSBundleSize).toBe('console.log(1)'.length)
    expect(metrics.totalCSSBundleSize).toBe('body{}'.length)
    expect(metrics.totalHTMLSize).toBe('home'.length + 'intro page'.length)
    expect(metrics.pages).toEqual([
      { route: '/', htmlSize: 4, htmlFile: 'index.html' },
      { route: '/docs/intro', htmlSize: 10, htmlFile: 'docs/intro.html' },
    ])
  })
})
