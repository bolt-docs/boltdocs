import { describe, expect, it } from 'vitest'
import { createClientController } from '../src/client/abort'

describe('createClientController', () => {
  it('uses the native AbortController when available', () => {
    const ctrl = createClientController()
    expect(ctrl.signal).toBeInstanceOf(AbortSignal)
    expect(ctrl.aborted).toBe(false)
    expect(typeof ctrl.abort).toBe('function')
    ctrl.abort()
    expect(ctrl.aborted).toBe(true)
  })

  it('cancels an attached stream reader on abort()', () => {
    const ctrl = createClientController()
    let cancelled = false
    ctrl.attachReader({ cancel: () => (cancelled = true) })
    ctrl.abort()
    expect(cancelled).toBe(true)
  })

  it('cancels a reader attached after abort() already ran', () => {
    const ctrl = createClientController()
    ctrl.abort()
    expect(ctrl.aborted).toBe(true)
    let cancelled = false
    ctrl.attachReader({ cancel: () => (cancelled = true) })
    expect(cancelled).toBe(true)
  })

  it('is idempotent — abort() more than once is a no-op', () => {
    const ctrl = createClientController()
    let count = 0
    ctrl.attachReader({ cancel: () => count++ })
    ctrl.abort()
    ctrl.abort()
    expect(count).toBe(1)
  })

  it('never throws when the native AbortController is missing', () => {
    const original = globalThis.AbortController
    try {
      ;(globalThis as { AbortController?: unknown }).AbortController = undefined
      expect(typeof AbortController).toBe('undefined')

      const ctrl = createClientController()
      // No real AbortSignal is available on fallback environments.
      expect(ctrl.signal).toBeUndefined()
      // A reader whose cancel() throws must not propagate.
      ctrl.attachReader({
        cancel: () => {
          throw new Error('reader already closed')
        },
      })
      ctrl.abort()
      expect(ctrl.aborted).toBe(true)
    } finally {
      ;(globalThis as { AbortController?: unknown }).AbortController = original
    }
  })
})
