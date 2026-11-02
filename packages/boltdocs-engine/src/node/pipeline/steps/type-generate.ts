import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'
import { generateProjectTypes, writeLinkTree } from '../../types-generator'

export class TypeGenerateStep implements PipelineStep<BuildContext> {
  name = 'TypeGenerate'

  async execute(ctx: BuildContext): Promise<void> {
    if (!ctx.config || !ctx.docsDir || !ctx.routePaths) {
      throw new Error(
        'Config, docs directory, or route paths not initialized. Verify pipeline order.',
      )
    }

    // This work is intentionally here, rather than in ConfigResolveStep, so
    // Pipeline can run it concurrently with SEO validation.
    generateProjectTypes(ctx.config, 'docs', ctx.root, ctx.routePaths)
    writeLinkTree(ctx.routePaths, ctx.root)
    ctx.typesGenerated = true
  }
}
