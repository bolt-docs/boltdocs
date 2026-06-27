import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'
import { resolveConfig } from '../../config'
import { createViteConfig } from '../../index'
import { inspectPluginsSecurity } from '../../security/inspect'

export class ConfigResolveStep implements PipelineStep<BuildContext> {
  name = 'ConfigResolve'

  async execute(ctx: BuildContext): Promise<void> {
    ctx.config = await resolveConfig('docs', ctx.root)
    inspectPluginsSecurity(ctx.config, ctx.root)
    ctx.viteConfig = await createViteConfig(
      ctx.root,
      'production',
      ctx.config,
      ctx.turbo,
    )
  }
}
