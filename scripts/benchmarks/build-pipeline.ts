import { Bench } from 'tinybench'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BenchmarkConfig, SuiteResult } from './utils/types'
import { collectSuiteResult } from './utils/types'
import { createFixtureDir, cleanupFixtureDir } from './utils/fixtures'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..')

export async function runBuildPipelineSuite(
  config: BenchmarkConfig,
): Promise<SuiteResult> {
  const fixtureDir = createFixtureDir({
    fileCount: 200,
    contentComplexity: 'medium',
    includeCodeBlocks: true,
    includeTables: true,
    includeHtml: true,
    includeMdxComponents: false,
  })

  try {
    const docsDir = path.join(fixtureDir, 'docs')

    const { generateRoutes, invalidateRouteCache } = await import(
      path.join(WORKSPACE_ROOT, 'packages', 'core', 'dist', 'node', 'index.mjs')
    )

    const bench = new Bench({
      name: 'Build Pipeline',
      time: config.time,
      iterations: config.iterations,
      warmupIterations: config.warmupIterations,
      warmupTime: config.warmupTime,
    })

    bench.add('generateRoutes (100 files)', async () => {
      invalidateRouteCache()
      await generateRoutes(docsDir, undefined, '/docs', true)
    })

    bench.add('generateRoutes (cached)', async () => {
      await generateRoutes(docsDir, undefined, '/docs', false)
    })

    bench.add('invalidateRouteCache', () => {
      invalidateRouteCache()
    })

    bench.add('sortRoutes (in-memory)', async () => {
      invalidateRouteCache()
      const routes = await generateRoutes(docsDir, undefined, '/docs', true)
      routes.sort((a: any, b: any) => {
        const posA = a.sidebarPosition ?? 999
        const posB = b.sidebarPosition ?? 999
        return posA - posB || a.title.localeCompare(b.title)
      })
    })

    bench.add('file crawl (fdir simulation)', () => {
      const entries = fs.readdirSync(docsDir, { withFileTypes: true })
      const mdFiles: string[] = []
      for (const entry of entries) {
        if (
          entry.isFile() &&
          (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))
        ) {
          if (!entry.name.startsWith('_')) {
            mdFiles.push(path.join(docsDir, entry.name))
          }
        }
      }
      mdFiles
    })

    bench.add('frontmatter extraction (200 files)', async () => {
      const entries = fs.readdirSync(docsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (
          entry.isFile() &&
          (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))
        ) {
          const content = fs.readFileSync(
            path.join(docsDir, entry.name),
            'utf-8',
          )
          content.match(/^---\n([\s\S]*?)\n---/)
        }
      }
    })

    const start = performance.now()
    await bench.run()
    const duration = performance.now() - start

    return collectSuiteResult('Build Pipeline', bench, duration)
  } finally {
    cleanupFixtureDir(fixtureDir)
  }
}
