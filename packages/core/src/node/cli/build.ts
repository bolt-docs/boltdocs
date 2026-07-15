import { preview } from 'vite'
import { colors, error, double, steps, table, divider } from '@bdocs/dui'
import { previewServer } from '../ui-utils'
import { notifyUpdateAvailable } from '../update-check'
import { createBuildPipeline } from '../pipeline/index'
import type { StepResult } from '../pipeline/types'
import { createViteConfig } from '../index'
import { flushCache } from '../cache'

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

export async function buildAction(
  root: string = process.cwd(),
  options: { turbo?: boolean } = {},
) {
  notifyUpdateAvailable()

  const turbo = options.turbo || process.env.BOLTDOCS_TURBO === 'true'

  if (turbo) {
    console.log(
      colors.yellow(
        '⚠ experimental — Turbo mode enabled, faster parser active',
      ),
    )
  }

  try {
    const pipeline = createBuildPipeline()
    const result = await pipeline.run({
      root,
      timing: {},
      turbo,
    })

    if (!result.success) {
      error(`Build failed at step "${result.failedStep}":`, result.error)
      await flushCache()
      process.exit(1)
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
    const viteConfig = await createViteConfig(root, 'production')
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
