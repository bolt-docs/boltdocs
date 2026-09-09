import { describe, expect, it, vi } from 'vitest'
import { createDevShutdownController } from '../../src/node/cli/dev-lifecycle'

describe('createDevShutdownController', () => {
  it('closes and resets only once when shutdown is requested repeatedly', async () => {
    const closeServer = vi.fn(async () => {})
    const reset = vi.fn()
    const exit = vi.fn()
    const controller = createDevShutdownController(closeServer, reset, exit)

    await Promise.all([controller.shutdown(0), controller.shutdown(0)])

    expect(closeServer).toHaveBeenCalledTimes(1)
    expect(reset).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(0)
    expect(controller.isShuttingDown()).toBe(true)
  })

  it('resets even when server.close fails', async () => {
    const closeServer = vi.fn(async () => {
      throw new Error('close failed')
    })
    const reset = vi.fn()
    const controller = createDevShutdownController(closeServer, reset, vi.fn())

    await expect(controller.shutdown()).rejects.toThrow('close failed')
    expect(reset).toHaveBeenCalledTimes(1)
    expect(controller.isShuttingDown()).toBe(true)
  })
})
