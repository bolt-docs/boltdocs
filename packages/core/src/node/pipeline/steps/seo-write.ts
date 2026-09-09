import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'
import { generateSitemap } from '../../seo/sitemap'
import { generateRobotsTxt } from '../../seo/robots'
import path from 'node:path'
import fs from 'node:fs'

export class SEOWriteStep implements PipelineStep<BuildContext> {
  name = 'SEOWrite'

  async execute(ctx: BuildContext): Promise<void> {
    if (!ctx.ssgRoutes || !ctx.config || !ctx.outDir) {
      throw new Error('SSG Routes, Config, or OutDir not initialized.')
    }

    const sitemap = generateSitemap(ctx.ssgRoutes, ctx.config)
    const docsDir = ctx.docsDir || path.resolve(ctx.root, 'docs')
    const targetOutDir = path.resolve(ctx.root, ctx.outDir)

    if (sitemap) {
      fs.writeFileSync(path.join(targetOutDir, 'sitemap.xml'), sitemap, 'utf-8')
    }

    const robots = generateRobotsTxt(ctx.config)
    fs.writeFileSync(path.join(targetOutDir, 'robots.txt'), robots, 'utf-8')

    // Execute 'build:generate' asset generation hook across plugins
    if (ctx.config.plugins && ctx.config.plugins.length > 0) {
      const { PluginLifecycleManager } = await import(
        '../../plugins/plugin-lifecycle'
      )
      const manager = new PluginLifecycleManager(
        ctx.config.plugins,
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
}
