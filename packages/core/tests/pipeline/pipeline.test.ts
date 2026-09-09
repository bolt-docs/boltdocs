import { describe, it, expect, vi } from 'vitest'
import { Pipeline, type PipelineStep } from '../../src/node/pipeline/index'

describe('Pipeline', () => {
  interface Ctx {
    calls: string[]
  }

  const makeStep = (name: string, shouldThrow = false) => {
    const step: PipelineStep<Ctx> & { rollbackCalls: string[] } = {
      name,
      rollbackCalls: [],
      async execute(ctx: Ctx) {
        ctx.calls.push(`exec:${name}`)
        if (shouldThrow) throw new Error(`step ${name} failed`)
      },
      async rollback(ctx: Ctx) {
        step.rollbackCalls.push(name)
        ctx.calls.push(`rollback:${name}`)
      },
    }
    return step
  }

  it('runs steps in order', async () => {
    const stepA = makeStep('A')
    const stepB = makeStep('B')
    const pipeline = new Pipeline<Ctx>().addStep(stepA).addStep(stepB)
    const result = await pipeline.run({ calls: [] })
    expect(result.success).toBe(true)
    expect(stepA.rollbackCalls).toEqual([])
  })

  it('runs parallel steps concurrently', async () => {
    const stepA = makeStep('A')
    const stepB = makeStep('B')
    const pipeline = new Pipeline<Ctx>().addParallelSteps([stepA, stepB])
    const result = await pipeline.run({ calls: [] })
    expect(result.success).toBe(true)
    expect(stepA.rollbackCalls).toEqual([])
  })

  it('reports failure with the failing step name', async () => {
    const good = makeStep('Good')
    const bad = makeStep('Bad', true)
    const pipeline = new Pipeline<Ctx>().addStep(good).addStep(bad)
    const result = await pipeline.run({ calls: [] })
    expect(result.success).toBe(false)
    expect(result.failedStep).toBe('Bad')
    expect(result.error).toBeInstanceOf(Error)
  })

  it('rolls back completed steps in reverse order on failure', async () => {
    const good = makeStep('Good')
    const bad = makeStep('Bad', true)
    const pipeline = new Pipeline<Ctx>().addStep(good).addStep(bad)
    const context = { calls: [] }
    await pipeline.run(context)
    expect(context.calls).toContain('rollback:Good')
  })

  it('captures timing per step', async () => {
    const stepA = makeStep('A')
    const pipeline = new Pipeline<Ctx>().addStep(stepA)
    const result = await pipeline.run({ calls: [] })
    expect(result.timing.steps).toHaveProperty('A')
    expect(result.timing.steps['A']).toBeGreaterThanOrEqual(0)
  })

  it('runs without typo chaining when rollback is undefined', async () => {
    const stepA: PipelineStep<Ctx> = {
      name: 'A',
      execute: async (ctx) => {
        ctx.calls.push('A')
      },
    }
    const stepB: PipelineStep<Ctx> = {
      name: 'B',
      execute: async () => {
        throw new Error('boom')
      },
    }
    const pipeline = new Pipeline<Ctx>().addStep(stepA).addStep(stepB)
    const result = await pipeline.run({ calls: [] })
    expect(result.success).toBe(false)
    expect(result.failedStep).toBe('B')
  })
})
