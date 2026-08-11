import { preview } from 'vite'
import { colors, error, double, steps, table, divider } from '@bdocs/dui'
import { previewServer } from '../ui-utils'
import { notifyUpdateAvailable } from '../update-check'
import { createBuildPipeline } from '../pipeline/index'
import type { StepResult } from '../pipeline/types'
import { createViteConfig } from '../index'
import { flushCache } from '../cache'
import fs from 'node:fs'
import path from 'node:path'

function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}

function buildStepList(stepResults: StepResult[]): Array<{
  label: string
  status: 'success' | 'error' | 'running' | 'pending'
  details?: string
}> {
  return stepResults.map((s) => ({
    label: s.name,
    status: s.success ? 'success' : 'error',
    details: s.details,
  }))
}

function writeBenchmarkReport(
  root: string,
  result: {
    success: boolean
    failedStep?: string
    error?: Error
    timing: { total: number; steps: Record<string, number> }
    stepResults: StepResult[]
  },
): string {
  const benchmarksDir = path.join(root, '.boltdocs', 'benchmarks')
  if (!fs.existsSync(benchmarksDir)) {
    fs.mkdirSync(benchmarksDir, { recursive: true })
  }
  const reportPath = path.join(
    benchmarksDir,
    `phases-report-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`,
  )
  const report = {
    timestamp: new Date().toISOString(),
    root,
    ...result,
    error: result.error?.message || result.error?.toString(),
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  return reportPath
}

export async function buildAction(
  root: string = process.cwd(),
  _options: {} = {},
) {
  process.env.NODE_ENV = 'production'
  notifyUpdateAvailable()

  const benchmarkMode = process.env.BOLTDOCS_BENCHMARK_PHASES === 'true'

  try {
    const pipeline = createBuildPipeline()
    const result = await pipeline.run({
      root,
      timing: {},
    })

    if (benchmarkMode) {
      console.log(
        `[boltdocs] ${JSON.stringify({
          name: 'Build pipeline',
          success: result.success,
          steps: result.stepResults.map((step) => ({
            name: step.name,
            duration: Math.round(step.duration),
            success: step.success,
            ...(step.details ? { details: step.details } : {}),
          })),
        })}`,
      )
    }

    if (!result.success) {
      error(`Build failed at step "${result.failedStep}":`, result.error)
      if (benchmarkMode) {
        const reportPath = writeBenchmarkReport(root, result)
        console.log(`[benchmark] failure report written to ${reportPath}`)
      }
      await flushCache()
      process.exit(1)
    }

    if (benchmarkMode) {
      const reportPath = writeBenchmarkReport(root, result)
      console.log(`[benchmark] phase report written to ${reportPath}`)
      await flushCache()
      process.exit(0)
    }

    const allSteps = buildStepList(result.stepResults)
    console.log('')
    console.log(steps(allSteps))
    console.log(divider('═', 44))
    console.log(
      `  ${colors.dim('Total'.padEnd(20))} ${colors.cyan(formatDuration(result.timing.total))}`,
    )
    console.log('')

    // Look for SSG build metrics in sub-steps
    const buildMetricsStep = result.stepResults.find(
      (s) => s.name === 'Build metrics',
    )
    const metrics = buildMetricsStep?.metrics
    if (metrics) {
      const toKB = (b: number) => (b / 1024).toFixed(0)
      const toMB = (b: number) => (b / 1024 / 1024).toFixed(1)
      const jsSize =
        metrics.jsSize > 1024 * 1024
          ? toMB(metrics.jsSize) + ' MB'
          : toKB(metrics.jsSize) + ' kB'
      const cssSize =
        metrics.cssSize > 1024 * 1024
          ? toMB(metrics.cssSize) + ' MB'
          : toKB(metrics.cssSize) + ' kB'

      console.log(
        table(
          ['Metric', 'Result'],
          [
            ['Build Time', formatDuration(metrics.buildTime)],
            ['Pages', String(metrics.totalPages)],
            ['JavaScript', jsSize],
            ['CSS', cssSize],
          ],
          { style: 'round', headerSeparator: true },
        ),
      )
      console.log('')
    }

    const totalTime = formatDuration(result.timing.total)
    console.log(
      double([
        `boltdocs build completed in ${totalTime}`,
        '',
        `${colors.cyan('boltdocs')} documentation is ready at ${colors.green('dist/')}`,
      ]),
    )
    await flushCache()
    process.exit(0)
  } catch (e) {
    error('Build failed:', e)
    await flushCache()
    process.exit(1)
  }
}

export async function previewAction(
  root: string = process.cwd(),
  options: { port?: number; host?: string | boolean } = {},
) {
  try {
    // Preview mode doesn't need route generation or types.
    // The production build (pipeline) already generated everything.
    // Skip types/link-tree to save ~700ms of unnecessary work.
    const viteConfig = await createViteConfig(root, 'production', undefined, {
      skipTypes: true,
      skipLinkTree: true,
    })
    viteConfig.logLevel = 'warn'
    viteConfig.clearScreen = false

    if (options.port !== undefined) {
      viteConfig.preview = viteConfig.preview || {}
      viteConfig.preview.port = Number(options.port)
    }
    if (options.host !== undefined) {
      viteConfig.preview = viteConfig.preview || {}
      viteConfig.preview.host = options.host
    }

    const server = await preview(viteConfig)
    const urls = server.resolvedUrls
    console.log(
      previewServer(
        urls?.local?.[0] ?? `http://localhost:${options.port ?? 4173}`,
        urls?.network?.[0] ?? null,
      ),
    )
  } catch (e) {
    error('Failed to start preview server:', e)
    process.exit(1)
  }
}
