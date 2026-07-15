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
  private steps: (PipelineStep<TContext> | PipelineStep<TContext>[])[] = []

  addStep(step: PipelineStep<TContext>): this {
    this.steps.push(step)
    return this
  }

  /**
   * Add steps that will execute in parallel.
   * All steps in the group must succeed for the pipeline to continue.
   */
  addParallelSteps(steps: PipelineStep<TContext>[]): this {
    this.steps.push(steps)
    return this
  }

  async run(initialContext: TContext): Promise<PipelineResult> {
    const stepResults: StepResult[] = []
    const totalStart = performance.now()
    const context = {
      ...initialContext,
      timing: {} as Record<string, number>,
    } as TContext

    for (const entry of this.steps) {
      const isParallel = Array.isArray(entry)
      const stepGroup = isParallel ? entry : [entry]
      const groupStart = performance.now()

      try {
        if (isParallel) {
          await Promise.all(stepGroup.map((step) => step.execute(context)))
        } else {
          await stepGroup[0].execute(context)
        }

        const duration = performance.now() - groupStart
        for (const step of stepGroup) {
          const details = (context as any).stepDetails?.[step.name]
          stepResults.push({
            name: step.name,
            duration,
            success: true,
            details,
          })
          ;(context as any).timing[step.name] = duration
        }

        // Collect sub-steps from SSGBuildStep
        if ((context as any).ssgSubSteps) {
          // Preserve metrics from sub-step results
          for (const subStep of (context as any).ssgSubSteps) {
            stepResults.push(subStep)
          }
          delete (context as any).ssgSubSteps
        }
      } catch (err) {
        const duration = performance.now() - groupStart
        const failedStep = stepGroup.find(
          (s) => !stepResults.some((r) => r.name === s.name && r.success),
        )
        const failedName =
          failedStep?.name || stepGroup.map((s) => s.name).join(' | ')

        stepResults.push({
          name: failedName,
          duration,
          success: false,
          error: err instanceof Error ? err : new Error(String(err)),
        })

        // Rollback completed steps in reverse order
        for (const completed of stepResults
          .filter((r) => r.success)
          .reverse()) {
          const allSteps = this.steps.flat()
          const stepToRollback = allSteps.find((s) => s.name === completed.name)
          if (stepToRollback?.rollback) {
            try {
              await stepToRollback.rollback(context)
            } catch (rollbackErr) {
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
          failedStep: failedName,
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
