import type { BoltdocsConfig } from '../config'
import type { RouteMeta } from '../routes/types'
import type { InlineConfig } from 'vite'

export interface BuildContext {
  root: string
  docsDir?: string
  config?: BoltdocsConfig
  routes?: RouteMeta[]
  /**
   * Deprecated compatibility alias for routes used by SEO/SSG output.
   * It references the same RouteMeta[] array; no adapter copy is created.
   */
  ssgRoutes?: RouteMeta[]
  viteConfig?: InlineConfig
  paths?: string[]
  /** Complete route-path contract used by generated types and link validation. */
  routePaths?: string[]
  outDir?: string
  timing: Record<string, number>
  stepDetails?: Record<string, string>
  ssgSubSteps?: StepResult[]
  /** Set by TypeGenerateStep after project types/link-tree are written. */
  typesGenerated?: boolean
  /** Set when all routes are cached (warm build); skips security inspection. */
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
