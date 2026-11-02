import { describe, expect, it } from 'vitest'
import {
  getRenderInFlightLimit,
  observeRenderTask,
} from '../src/node/render-scheduling-policy'

describe('getRenderInFlightLimit', () => {
  it('keeps two tasks per worker in flight', () => {
    expect(getRenderInFlightLimit(4)).toBe(8)
    expect(getRenderInFlightLimit(1)).toBe(2)
  })

  it('handles invalid worker counts safely', () => {
    expect(getRenderInFlightLimit(0)).toBe(2)
    expect(getRenderInFlightLimit(Number.NaN)).toBe(2)
  })

  it('caps pathological worker counts', () => {
    expect(getRenderInFlightLimit(100)).toBe(32)
  })

  it('observes rejected tasks without propagating early', async () => {
    const outcome = await observeRenderTask(
      Promise.reject(new Error('render failed')),
    )

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error).toBeInstanceOf(Error)
  })
})
