import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'
import { generateRoutes } from '../../routes/index'
import { adaptRoutesForSSG } from '../../routes/route-adapter'
import path from 'node:path'

export class RouteGenerateStep implements PipelineStep<BuildContext> {
  name = 'RouteGenerate'

  async execute(ctx: BuildContext): Promise<void> {
    if (!ctx.config) {
      throw new Error('Config not resolved. Run ConfigResolve first.')
    }
    const docsDir = path.resolve(ctx.root, 'docs')
    const basePath = ctx.viteConfig?.base || ctx.config.base || '/docs'
    const routes = await generateRoutes(docsDir, ctx.config, basePath)

    // Shallow copy array to prevent unintended side effects and support clean rollback
    ctx.routes = [...routes]
    ctx.ssgRoutes = adaptRoutesForSSG(ctx.routes)
  }
}
