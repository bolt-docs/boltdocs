import { describe, it, expect, vi, afterEach } from 'vitest'

/**
 * Tests for createZigCrittersPool in src/node/zig-pool.ts.
 * worker_threads.Worker is mocked entirely; the module under test only wires
 * pool lifecycle (wrap, fallback, dispose) — extraction semantics are covered
 * by packages/zig-critters/wasm/index.test.mjs.
 */

const workerInstances: any[] = []

vi.mock('node:worker_threads', () => ({
  Worker: vi.fn().mockImplementation(() => {
    const instance: any = {
      on: vi.fn(),
      once: vi.fn(),
      postMessage: vi.fn(),
      terminate: vi.fn().mockResolvedValue(0),
      unref: vi.fn(),
    }
    workerInstances.push(instance)
    return instance
  }),
}))

vi.mock('@bdocs/zig-critters', () => ({
  createPool: vi.fn(),
}))

import { createZigCrittersPool } from '../src/node/zig-pool'
import { createPool } from '@bdocs/zig-critters'

afterEach(() => {
  workerInstances.length = 0
  vi.clearAllMocks()
})

describe('createZigCrittersPool', () => {
  it('wraps the underlying pool and forwards extraction', async () => {
    const extract = vi
      .fn()
      .mockResolvedValue({ criticalCss: '.a{}', stats: {} })
    vi.mocked(createPool).mockResolvedValue({
      concurrency: 4,
      extractCriticalCss: extract,
      close: vi.fn().mockResolvedValue(undefined),
    } as any)

    const handle = await createZigCrittersPool({ concurrency: 4 })
    expect(handle).not.toBeNull()
    expect(handle!.concurrency).toBe(4)

    await handle!.extractCriticalCss('<html></html>', '.a{}')
    expect(extract).toHaveBeenCalledWith('<html></html>', '.a{}', undefined)
  })

  it('returns null when the package exposes no pool API', async () => {
    vi.mocked(createPool).mockResolvedValue(null as any)
    const handle = await createZigCrittersPool()
    expect(handle).toBeNull()
  })

  it('returns null when pool creation throws', async () => {
    vi.mocked(createPool).mockRejectedValue(new Error('no threads'))
    const handle = await createZigCrittersPool()
    expect(handle).toBeNull()
  })

  it('dispose() closes the underlying pool', async () => {
    const close = vi.fn().mockResolvedValue(undefined)
    vi.mocked(createPool).mockResolvedValue({
      concurrency: 2,
      extractCriticalCss: vi.fn(),
      close,
    } as any)

    const handle = await createZigCrittersPool()
    await handle!.dispose()
    expect(close).toHaveBeenCalledOnce()
  })
})
