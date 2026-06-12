import type { PipelineResult, StepResult } from './types'
import { PipelineError } from './types'

export type { PipelineResult, StepResult, BuildContext } from './types'
export { PipelineError }
export { createBuildPipeline } from './build-pipeline'

export interface PipelineStep<TContext = Record<string, unknown>> {
  name: string
  execute(ctx: TContext): Promise<void>
  rollback?(ctx: TContext): Promise<void>
}

export class Pipeline<TContext> {
  private steps: PipelineStep<TContext>[] = []

  addStep(step: PipelineStep<TContext>): this {
    this.steps.push(step)
    return this
  }

  async run(initialContext: TContext): Promise<PipelineResult> {
    const stepResults: StepResult[] = []
    const totalStart = performance.now()
    const context = {
      ...initialContext,
      timing: {} as Record<string, number>,
    } as TContext

    for (const step of this.steps) {
      const stepStart = performance.now()
      try {
        await step.execute(context)

        const duration = performance.now() - stepStart
        stepResults.push({ name: step.name, duration, success: true })
        ;(context as any).timing[step.name] = duration
      } catch (err) {
        const duration = performance.now() - stepStart
        stepResults.push({
          name: step.name,
          duration,
          success: false,
          error: err instanceof Error ? err : new Error(String(err)),
        })

        // Rollback completed steps in reverse order
        for (const completed of stepResults
          .filter((r) => r.success)
          .reverse()) {
          const stepToRollback = this.steps.find(
            (s) => s.name === completed.name,
          )
          if (stepToRollback?.rollback) {
            try {
              await stepToRollback.rollback(context)
            } catch (rollbackErr) {
              // Log rollback failure but don't throw
              console.error(
                `[pipeline] rollback failed for step "${completed.name}":`,
                rollbackErr,
              )
            }
          }
        }

        const totalDuration = performance.now() - totalStart
        return {
          success: false,
          failedStep: step.name,
          error: err instanceof Error ? err : new Error(String(err)),
          timing: { total: totalDuration, steps: (context as any).timing },
          stepResults,
        }
      }
    }

    const totalDuration = performance.now() - totalStart
    return {
      success: true,
      timing: { total: totalDuration, steps: (context as any).timing },
      stepResults,
    }
  }
}
