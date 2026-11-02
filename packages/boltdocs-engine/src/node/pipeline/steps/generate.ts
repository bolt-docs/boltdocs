import path from 'node:path'
import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'

/**
 * Fires the plugin `build:generate` hook.
 *
 * Runs after the SSG build, when output files exist, and is the hook for
 * producing additional artifacts: feeds, sitemaps, generated indexes.
 *
 * This step used to be the tail of `SEOWriteStep`, which made the hook
 * unreachable for anyone who removed SEO and made `@bdocs/plugin-rss` depend on
 * an SEO step it has nothing to do with. The hook now has its own step and no
 * plugin is required for it to fire.
 */
export class GenerateStep implements PipelineStep<BuildContext> {
  name = 'Generate'

  async execute(ctx: BuildContext): Promise<void> {
    const plugins = ctx.config?.plugins
    if (!plugins || plugins.length === 0) return
    if (!ctx.config) return

    const docsDir = ctx.docsDir || path.resolve(ctx.root, 'docs')
    const targetOutDir = path.resolve(ctx.root, ctx.outDir ?? 'dist')

    const { PluginLifecycleManager } = await import(
      '../../plugins/plugin-lifecycle'
    )
    const manager = new PluginLifecycleManager(
      plugins,
      ctx.config,
      docsDir,
      ctx.root,
      ctx.routes ?? [],
      targetOutDir,
    )
    await manager.runHook('build:generate', {
      routes: ctx.routes ?? [],
      outDir: targetOutDir,
      siteUrl: ctx.config.siteUrl,
    })
  }
}
