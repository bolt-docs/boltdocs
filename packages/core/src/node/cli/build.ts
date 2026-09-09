import { preview } from 'vite'
import { error } from '@bdocs/dui'
import { buildSummary, previewServer } from '../ui-utils'
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

/**
 * SSG sub-phases reported inside the 'SSG build' pipeline step. They are
 * omitted from the summary to keep the output compact — their metrics are
 * surfaced through the build summary line instead.
 */
const SSG_SUB_STEPS = new Set([
  'Client build',
  'Server build',
  'Render pages',
  'Static loader data',
  'Build metrics',
])

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

    // Surface only top-level pipeline steps — SSG sub-phases (client/server
    // build, render, static loader data, build metrics) are folded into the
    // 'SSG build' step and their metrics appear on the summary line.
    const topLevelSteps = result.stepResults.filter(
      (step) => !SSG_SUB_STEPS.has(step.name),
    )

    const buildMetricsStep = result.stepResults.find(
      (step) => step.name === 'Build metrics',
    )
    const metrics = buildMetricsStep?.metrics
    const toKB = (b: number) => (b / 1024).toFixed(0)
    const toMB = (b: number) => (b / 1024 / 1024).toFixed(1)
    const formatSize = (bytes: number) =>
      bytes > 1024 * 1024 ? `${toMB(bytes)} MB` : `${toKB(bytes)} kB`

    console.log(
      buildSummary({
        totalMs: result.timing.total,
        steps: topLevelSteps.map((step) => ({
          name: step.name,
          success: step.success,
          duration: step.duration,
          details: step.details,
        })),
        pages: metrics?.totalPages,
        jsSize: metrics ? formatSize(metrics.jsSize) : undefined,
        cssSize: metrics ? formatSize(metrics.cssSize) : undefined,
        outDir: 'dist/',
      }),
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

    const startedAt = performance.now()
    const server = await preview(viteConfig)
    const urls = server.resolvedUrls
    console.log(
      previewServer(
        urls?.local?.[0] ?? `http://localhost:${options.port ?? 4173}`,
        urls?.network?.[0] ?? null,
        { readyIn: performance.now() - startedAt },
      ),
    )
  } catch (e) {
    error('Failed to start preview server:', e)
    process.exit(1)
  }
}
