import { describe, it, expect, vi } from 'vitest'
import { executeRenderSchedule } from '../src/node/pipeline/render-executor'

/**
 * Batches render sequentially inside a worker, so batch size directly caps how
 * much parallelism the pool can express. These lock the scheduling shape so a
 * later "optimization" that widens the batch does not silently reintroduce the
 * serialization.
 */
type BatchPool = { renderBatch: ReturnType<typeof vi.fn> }

function makeInput(overrides: Record<string, unknown> = {}) {
  const result = (path: string) => ({
    path,
    appHTML: `<div>${path}</div>`,
    metaAttributes: [] as string[],
    bodyAttributes: '',
    htmlAttributes: '',
    styleTag: '',
    routerContext: { loaderData: {} },
    timings: { totalMs: 1 },
  })

  const worker = {
    render: vi.fn(async (path: string) => result(path)),
    renderBatch: vi.fn(async (paths: string[]) => paths.map(result)),
    destroy: vi.fn(async () => {}),
  }

  const input = {
    getPool: () => worker,
    ensurePool: vi.fn(async () => {}),
    routes: Array.from({ length: 12 }, (_, i) => `/p${i}`),
    getPlan: (path: string) => ({ path }) as never,
    isCached: vi.fn(async () => false),
    onWorkerResult: vi.fn(async () => {}),
    onWorkerFailure: vi.fn(),
    prepareRoute: vi.fn(async () => {}),
    scheduleMainThread: vi.fn(),
    drainMainThread: vi.fn(async () => {}),
    drainFinalizers: vi.fn(async () => {}),
    drainWrites: vi.fn(async () => {}),
    cleanupAfterFailure: vi.fn(async () => {}),
    destroyPool: vi.fn(async () => {}),
    getWorkerCount: () => 6,
    ...overrides,
  } as never

  return {
    input,
    pool: worker as BatchPool,
    onWorkerResult: (
      input as unknown as { onWorkerResult: ReturnType<typeof vi.fn> }
    ).onWorkerResult,
  }
}

describe('render batch scheduling', () => {
  it('defaults to small batches so workers can interleave', async () => {
    const { input, pool } = makeInput()

    await executeRenderSchedule(input)

    // 12 pages at the default batch of 2 is 6 batches, not 1. A batch sized to
    // the in-flight window becomes one long serial job per worker.
    expect(pool.renderBatch).toHaveBeenCalledTimes(6)
  })

  it('honours an explicit batch size', async () => {
    const { input, pool } = makeInput({ batchSize: 4 })

    await executeRenderSchedule(input)

    expect(pool.renderBatch).toHaveBeenCalledTimes(3)
  })

  it('never uses a batch smaller than two', async () => {
    const { input, pool } = makeInput({ batchSize: 1 })

    await executeRenderSchedule(input)

    expect(pool.renderBatch).toHaveBeenCalledTimes(6)
  })

  it('passes the page index within its batch to the result handler', async () => {
    const { input, onWorkerResult } = makeInput({ batchSize: 2 })

    await executeRenderSchedule(input)

    // Consumers dedupe per batch using this index; every batch must report
    // index 0 exactly once.
    const firstIndexes = onWorkerResult.mock.calls.filter(
      ([, , , , batchIndex]) => batchIndex === 0,
    )
    expect(firstIndexes).toHaveLength(6)
  })
})
