import type { BoltdocsConfig } from '../config'
import type { RouteMeta } from '../routes/types'
import type { SSGRouteData } from '../routes/route-adapter'
import type { InlineConfig } from 'vite'

export interface BuildContext {
  root: string
  config?: BoltdocsConfig
  routes?: RouteMeta[]
  ssgRoutes?: SSGRouteData[]
  viteConfig?: InlineConfig
  paths?: string[]
  outDir?: string
  timing: Record<string, number>
  stepDetails?: Record<string, string>
  ssgSubSteps?: StepResult[]
  /** Turbo mode flag; passed through from CLI / environment. */
  turbo?: boolean
  /** Set by ConfigResolveStep when project types/link-tree have been generated. */
  typesGenerated?: boolean
  /** PR-01: Set when all routes are cached (warm build); skips security inspection. */
  allCached?: boolean
}

export interface StepResult {
  name: string
  duration: number
  success: boolean
  error?: Error
  details?: string
  metrics?: Record<string, any>
}

export interface PipelineResult {
  success: boolean
  failedStep?: string
  error?: Error
  timing: {
    total: number
    steps: Record<string, number>
  }
  stepResults: StepResult[]
}

export class PipelineError extends Error {
  constructor(
    public stepName: string,
    public cause: unknown,
  ) {
    super(
      `Pipeline failed at step "${stepName}": ${cause instanceof Error ? cause.message : String(cause)}`,
    )
    this.name = 'PipelineError'
  }
}
