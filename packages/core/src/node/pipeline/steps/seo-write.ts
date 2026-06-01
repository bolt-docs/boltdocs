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
    const targetOutDir = path.resolve(ctx.root, ctx.outDir)

    if (sitemap) {
      fs.writeFileSync(path.join(targetOutDir, 'sitemap.xml'), sitemap, 'utf-8')
    }

    const robots = generateRobotsTxt(ctx.config)
    fs.writeFileSync(path.join(targetOutDir, 'robots.txt'), robots, 'utf-8')
  }
}
