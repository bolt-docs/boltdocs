import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'
import type { StepResult } from '../types'
import { build as ssgBuild } from '@bdocs/ssg/node'
import path from 'node:path'

export class SSGBuildStep implements PipelineStep<BuildContext> {
  name = 'SSGBuild'

  async execute(ctx: BuildContext): Promise<void> {
    if (!ctx.routes || !ctx.viteConfig) {
      throw new Error('Routes or ViteConfig not initialized.')
    }

    const routeToSourceFileMap: Record<string, string> = {}
    for (const route of ctx.routes) {
      if (route.path && route.componentPath) {
        routeToSourceFileMap[route.path] = route.componentPath
        const normalized = route.path.replace(/\/$/, '')
        routeToSourceFileMap[normalized] = route.componentPath
      }
    }

    const ssgSubSteps: StepResult[] = []

    await ssgBuild(
      {
        entry: 'boltdocs/entry',
        routeToSourceFileMap,
        cacheDir: path.resolve(ctx.root, '.boltdocs/build'),
        onStep: (step) => {
          ssgSubSteps.push(step)
        },
      },
      ctx.viteConfig,
    )

    ctx.ssgSubSteps = ssgSubSteps

    // Store the resulting output folder
    ctx.outDir = ctx.viteConfig.build?.outDir || 'dist'
  }
}
