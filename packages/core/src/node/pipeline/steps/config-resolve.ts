import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'
import { resolveConfig } from '../../config'
import { createViteConfig } from '../../index'
import { inspectPluginsSecurity } from '../../security/inspect'
import { generateRoutes, getExternalRoutePaths } from '../../routes'
import path from 'node:path'

export class ConfigResolveStep implements PipelineStep<BuildContext> {
  name = 'ConfigResolve'

  async execute(ctx: BuildContext): Promise<void> {
    ctx.config = await resolveConfig('docs', ctx.root, 'build', 'production')

    // Skip plugin security inspection on warm builds when routes
    // are already cached (no source changes).  inspectPluginsSecurity
    // reads each plugin's package.json to verify security constraints,
    // which costs ~200-500ms on cold builds.
    if (!ctx.allCached) {
      inspectPluginsSecurity(ctx.config, ctx.root)
    }

    // Generate routes once here in the pipeline so the work is not duplicated
    // inside createViteConfig and the plugin config hook.
    const docsDir = path.resolve(ctx.root, ctx.config.docsDir || 'docs')
    ctx.docsDir = docsDir
    const routes = await generateRoutes(docsDir, ctx.config, undefined, false)
    ctx.routes = routes

    // Keep the complete route contract on the context. Type generation and
    // link-tree writing happen in TypeGenerateStep, which runs in parallel
    // with SEO validation after this step completes.
    const routePaths = routes.map((r) => r.path)
    const basePath = (ctx.config.base || '/docs').replace(/\/$/, '')
    if (!routePaths.includes(basePath)) routePaths.push(basePath)
    const externalPaths = getExternalRoutePaths(docsDir, ctx.config)
    for (const p of externalPaths) {
      if (!routePaths.includes(p)) routePaths.push(p)
    }
    ctx.routePaths = routePaths

    ctx.viteConfig = await createViteConfig(
      ctx.root,
      'production',
      ctx.config,
      {
        routes,
        skipTypes: true,
        skipLinkTree: true,
      },
    )
  }
}
