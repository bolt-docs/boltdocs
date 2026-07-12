import { Pipeline } from './index'
import type { BuildContext } from './types'
import { ConfigResolveStep } from './steps/config-resolve'
import { RouteGenerateStep } from './steps/route-generate'
import { SEOValidateStep } from './steps/seo-validate'
import { TypeGenerateStep } from './steps/type-generate'
import { SSGBuildStep } from './steps/ssg-build'
import { SEOWriteStep } from './steps/seo-write'

/**
 * Creates the build pipeline for a Boltdocs site.
 */
export function createBuildPipeline(): Pipeline<BuildContext> {
  return new Pipeline<BuildContext>()
    .addStep(new ConfigResolveStep())
    .addStep(new RouteGenerateStep())
    .addParallelSteps([new SEOValidateStep(), new TypeGenerateStep()])
    .addStep(new SSGBuildStep())
    .addStep(new SEOWriteStep())
}
