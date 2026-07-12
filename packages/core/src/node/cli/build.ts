import { preview } from 'vite'
import { colors, error, double } from '@bdocs/dui'
import { previewServer } from '../ui-utils'
import { notifyUpdateAvailable } from '../update-check'
import { createBuildPipeline } from '../pipeline/index'
import { createViteConfig } from '../index'
import { flushCache } from '../cache'

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

    // Log per-step timing
    console.log('')
    console.log(colors.dim('[pipeline] Build steps:'))
    for (const step of result.stepResults) {
      const ms = step.duration < 1000
        ? `${Math.round(step.duration)}ms`
        : `${(step.duration / 1000).toFixed(1)}s`
      console.log(`  ${colors.dim(step.name.padEnd(20))} ${ms}`)
    }
    const totalTime = result.timing.total < 1000
      ? `${Math.round(result.timing.total)}ms`
      : `${(result.timing.total / 1000).toFixed(1)}s`
    console.log(`  ${colors.dim('Total'.padEnd(20))} ${colors.cyan(totalTime)}`)
    console.log('')

    console.log(
      double([
        `SSG build completed in ${(Math.round(result.timing.total) / 1000).toFixed(1)}s`,
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
