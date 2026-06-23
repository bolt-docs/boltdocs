import { Bench } from 'tinybench'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { BenchmarkConfig, SuiteResult } from './utils/types'
import { collectSuiteResult } from './utils/types'
import { createFixtureDir, cleanupFixtureDir } from './utils/fixtures'

function computeClientCodeHash(root: string): string {
  const excludedDirs = new Set([
    'node_modules',
    '.git',
    '.boltdocs',
    '.turbo',
    'dist',
    'coverage',
  ])
  const hash = crypto.createHash('sha256')

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (excludedDirs.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else {
        const stat = fs.statSync(full)
        hash.update(`${full}:${stat.mtimeMs}:${stat.size}`)
      }
    }
  }

  walk(root)
  return hash.digest('hex')
}

function computeClientCodeHashAsync(root: string): Promise<string> {
  const excludedDirs = new Set([
    'node_modules',
    '.git',
    '.boltdocs',
    '.turbo',
    'dist',
    'coverage',
  ])
  const hash = crypto.createHash('sha256')

  async function walk(dir: string) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })
    const promises: Promise<void>[] = []
    for (const entry of entries) {
      if (excludedDirs.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        promises.push(walk(full))
      } else {
        promises.push(
          fs.promises.stat(full).then((stat) => {
            hash.update(`${full}:${stat.mtimeMs}:${stat.size}`)
          }),
        )
      }
    }
    await Promise.all(promises)
  }

  return walk(root).then(() => hash.digest('hex'))
}

export async function runViteBuildSuite(
  config: BenchmarkConfig,
): Promise<SuiteResult> {
  const fixtureDir = createFixtureDir({
    fileCount: 500,
    contentComplexity: 'medium',
    includeCodeBlocks: true,
    includeTables: false,
    includeHtml: false,
    includeMdxComponents: false,
  })

  try {
    const bench = new Bench({
      name: 'Vite Build',
      time: config.time,
      iterations: config.iterations,
      warmupIterations: config.warmupIterations,
      warmupTime: config.warmupTime,
    })

    bench.add('computeClientCodeHash (sync, 500 files)', () => {
      computeClientCodeHash(fixtureDir)
    })

    bench.add('computeClientCodeHash (async, 500 files)', async () => {
      await computeClientCodeHashAsync(fixtureDir)
    })

    bench.add('computeClientCodeHash (cached)', () => {
      computeClientCodeHash(fixtureDir)
    })

    bench.add('file stat (500 files)', () => {
      const entries = fs.readdirSync(fixtureDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) {
          fs.statSync(path.join(fixtureDir, entry.name))
        }
      }
    })

    bench.add('manifest parse (simulated)', () => {
      const manifest: Record<string, any> = {}
      for (let i = 0; i < 50; i++) {
        manifest[`src/components/page-${i}.tsx`] = {
          file: `assets/page-${i}-abc${i}.js`,
          src: `src/components/page-${i}.tsx`,
          isEntry: i === 0,
          css: i % 3 === 0 ? [`assets/page-${i}-def${i}.css`] : [],
          imports: [`_vendor-${i}.js`],
          dynamicImports: i % 5 === 0 ? [`lazy-${i}.js`] : [],
        }
      }
      JSON.stringify(manifest)
      JSON.parse(JSON.stringify(manifest))
    })

    bench.add('Vite config merge (simulated)', () => {
      const base = {
        root: fixtureDir,
        base: '/docs/',
        build: { outDir: 'dist', minify: true },
        resolve: { alias: {} },
        plugins: [],
      }
      const override = {
        build: { outDir: 'dist', rollupOptions: { input: {} } },
        resolve: { alias: { '@': path.join(fixtureDir, 'src') } },
      }
      const merged = { ...base, ...override }
      merged.build = { ...base.build, ...override.build }
      merged.resolve = { ...base.resolve, ...override.resolve }
      merged.resolve.alias = {
        ...base.resolve.alias,
        ...override.resolve.alias,
      }
      merged
    })

    bench.add('routesToPaths (500 routes)', () => {
      const routes: string[] = []
      for (let i = 0; i < 500; i++) {
        routes.push(`/docs/page-${i}`)
      }
      const paths = routes.map((r) => {
        const parts = r.split('/').filter(Boolean)
        return parts.join('/')
      })
      paths
    })

    bench.add('SHA-256 hash (500 strings)', () => {
      const hash = crypto.createHash('sha256')
      for (let i = 0; i < 500; i++) {
        hash.update(`file-${i}:content-${i}`)
      }
      hash.digest('hex')
    })

    bench.add('MD5 hash (500 strings)', () => {
      const hash = crypto.createHash('md5')
      for (let i = 0; i < 500; i++) {
        hash.update(`file-${i}:content-${i}`)
      }
      hash.digest('hex')
    })

    const start = performance.now()
    await bench.run()
    const duration = performance.now() - start

    return collectSuiteResult('Vite Build', bench, duration)
  } finally {
    cleanupFixtureDir(fixtureDir)
  }
}
