import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'
import { generateProjectTypes, writeLinkTree } from '../../types-generator'
import path from 'node:path'

export class TypeGenerateStep implements PipelineStep<BuildContext> {
  name = 'TypeGenerate'

  async execute(ctx: BuildContext): Promise<void> {
    if (!ctx.config || !ctx.routes) {
      throw new Error('Config or Routes not initialized.')
    }
    const docsDir = path.resolve(ctx.root, 'docs')
    const routePaths = ctx.routes.map((r) => r.path)
    const basePath = (ctx.config.base || '/docs').replace(/\/$/, '')
    if (!routePaths.includes(basePath)) {
      routePaths.push(basePath)
    }

    generateProjectTypes(ctx.config, docsDir, ctx.root, routePaths)
    writeLinkTree(routePaths)
  }
}
