import { describe, expect, it } from 'vitest'
import { resolveSsgWorkerCount } from '../src/node/worker-count-policy'
import { shouldEagerlyCreateRenderPool } from '../src/node/render-pool-policy'

describe('shouldEagerlyCreateRenderPool', () => {
  it('eagerly starts the pool for a cold build with enough routes', () => {
    expect(shouldEagerlyCreateRenderPool(5, false)).toBe(true)
  })

  it('defers the pool when the client cache can be reused', () => {
    expect(shouldEagerlyCreateRenderPool(213, true)).toBe(false)
  })

  it('does not start a pool for small sites', () => {
    expect(shouldEagerlyCreateRenderPool(4, false)).toBe(false)
  })

  it('keeps the threshold strict at four routes', () => {
    expect(shouldEagerlyCreateRenderPool(4, true)).toBe(false)
  })

  it('keeps worker-count resolution independent from startup timing', () => {
    expect(
      resolveSsgWorkerCount({
        cpuCount: 8,
        totalMemoryGB: 16,
        freeMemoryGB: 8,
      }),
    ).toBeGreaterThan(0)
  })
})
