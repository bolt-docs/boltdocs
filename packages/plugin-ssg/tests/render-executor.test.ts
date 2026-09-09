import { describe, expect, it, vi } from 'vitest'
import type { SsgRenderResult } from '../src/node/ssg-worker-pool'
import {
  executeRenderSchedule,
  type RenderPoolLike,
} from '../src/node/pipeline/render-executor'
import type { RenderPlan } from '../src/node/pipeline/render-plan'

const makePlan = (path: string): RenderPlan =>
  Object.freeze({
    path,
    pathHash: path,
    cachedHtmlFile: `${path}.html`,
    cachedLoaderFile: `${path}.json`,
    finalOutFile: `${path}/index.html`,
    normalizedKey: path,
    sourceContentHash: 'source',
    sourceMtimeMs: 0,
    routeAssetHash: 'assets',
    fetchUrl: path,
  })

const resultFor = (path: string): SsgRenderResult => ({
  path,
  appHTML: `<main>${path}</main>`,
  metaAttributes: [],
  bodyAttributes: '',
  htmlAttributes: '',
  styleTag: undefined,
  routerContext: null,
})

function makeInput(overrides: Record<string, unknown> = {}) {
  const routes = ['/a', '/b', '/c', '/d', '/e']
  const plans = new Map(routes.map((path) => [path, makePlan(path)]))
  const rendered: string[] = []
  const cached: string[] = []
  const finalized: string[] = []
  let pool: RenderPoolLike | null = null

  return {
    routes,
    rendered,
    cached,
    finalized,
    input: {
      routes,
      canBypassClientBuild: false,
      getPlan: (path: string) => plans.get(path)!,
      isCached: (plan: RenderPlan) => plan.path === '/a',
      onCacheHit: async (plan: RenderPlan) => {
        cached.push(plan.path)
      },
      ensurePool: async () => {},
      getPool: () => pool,
      getWorkerCount: () => 1,
      onWorkerFailure: async (path: string) => resultFor(path),
      onWorkerResult: async (path: string) => {
        rendered.push(path)
        finalized.push(path)
      },
      scheduleMainThread: (path: string) => {
        rendered.push(path)
        finalized.push(path)
      },
      drainMainThread: async () => {},
      drainFinalizers: async () => {},
      drainWrites: async () => {},
      cleanupAfterFailure: async () => {},
      destroyPool: async () => {},
      ...overrides,
    },
    setPool(nextPool: RenderPoolLike | null) {
      pool = nextPool
    },
  }
}

describe('executeRenderSchedule', () => {
  it('keeps cache hits out of the renderer and renders the remaining routes', async () => {
    const fixture = makeInput()
    const render = vi.fn(async (path: string) => resultFor(path))
    fixture.setPool({
      render,
      destroy: vi.fn(async () => {}),
    })

    const result = await executeRenderSchedule(fixture.input)

    expect(result.cachedCount).toBe(1)
    expect(result.renderedCount).toBe(4)
    expect(fixture.cached).toEqual(['/a'])
    expect(render).toHaveBeenCalledTimes(4)
    expect(fixture.finalized).toEqual(['/b', '/c', '/d', '/e'])
  })

  it('batches uncached routes when the pool supports batch rendering', async () => {
    const fixture = makeInput({
      isCached: () => false,
      batchSize: 2,
    })
    const renderBatch = vi.fn(async (paths: readonly string[]) =>
      paths.map((path) => resultFor(path)),
    )
    fixture.setPool({
      render: async (path: string) => resultFor(path),
      renderBatch,
      destroy: vi.fn(async () => {}),
    })

    const result = await executeRenderSchedule(fixture.input)

    expect(result.renderedCount).toBe(5)
    expect(result.workerTaskCount).toBe(3)
    expect(renderBatch).toHaveBeenCalledTimes(3)
    expect(renderBatch.mock.calls.map(([paths]) => paths)).toEqual([
      ['/a', '/b'],
      ['/c', '/d'],
      ['/e'],
    ])
    expect(fixture.finalized).toHaveLength(5)
    expect(new Set(fixture.finalized)).toEqual(
      new Set(['/a', '/b', '/c', '/d', '/e']),
    )
    expect(fixture.finalized).toHaveLength(new Set(fixture.finalized).size)
  })

  it('recovers an entire rejected batch once per route', async () => {
    const fixture = makeInput({
      isCached: () => false,
      batchSize: 3,
    })
    const fallback = vi.fn(async (path: string) => resultFor(path))
    fixture.input.onWorkerFailure = fallback
    const renderBatch = vi.fn(async () => {
      throw new Error('batch transport failed')
    })
    fixture.setPool({
      render: async (path: string) => resultFor(path),
      renderBatch,
      destroy: vi.fn(async () => {}),
    })

    const result = await executeRenderSchedule(fixture.input)

    expect(result.renderedCount).toBe(5)
    expect(fallback).toHaveBeenCalledTimes(5)
    expect(fixture.finalized).toHaveLength(5)
    expect(new Set(fixture.finalized)).toEqual(
      new Set(['/a', '/b', '/c', '/d', '/e']),
    )
    expect(fixture.finalized).toHaveLength(new Set(fixture.finalized).size)
  })

  it('recovers malformed batch items without throwing a secondary type error', async () => {
    const fixture = makeInput({
      isCached: () => false,
      batchSize: 5,
    })
    const fallback = vi.fn(async (path: string) => resultFor(path))
    fixture.input.onWorkerFailure = fallback
    const renderBatch = vi.fn(
      async () =>
        [
          null,
          resultFor('/b'),
          resultFor('/c'),
          resultFor('/d'),
          resultFor('/e'),
        ] as never,
    )
    fixture.setPool({
      render: async (path: string) => resultFor(path),
      renderBatch,
      destroy: vi.fn(async () => {}),
    })

    const result = await executeRenderSchedule(fixture.input)

    expect(result.renderedCount).toBe(5)
    expect(fallback).toHaveBeenCalledWith(
      '/a',
      expect.anything(),
      expect.objectContaining({
        message: 'SSG worker returned an invalid batch item',
      }),
      expect.anything(),
    )
    expect(fixture.finalized).toHaveLength(5)
    expect(new Set(fixture.finalized)).toEqual(
      new Set(['/a', '/b', '/c', '/d', '/e']),
    )
    expect(fixture.finalized).toHaveLength(new Set(fixture.finalized).size)
  })

  it('does not repeat completed batch results when a later finalizer fails', async () => {
    const fixture = makeInput({
      isCached: () => false,
      batchSize: 3,
    })
    const renderBatch = vi.fn(async (paths: readonly string[]) =>
      paths.map((path) => resultFor(path)),
    )
    fixture.input.onWorkerResult = vi.fn(async (path: string) => {
      fixture.rendered.push(path)
      fixture.finalized.push(path)
      if (path === '/b') throw new Error('write failed')
    })
    fixture.setPool({
      render: async (path: string) => resultFor(path),
      renderBatch,
      destroy: vi.fn(async () => {}),
    })

    await expect(executeRenderSchedule(fixture.input)).rejects.toThrow(
      'write failed',
    )
    expect(fixture.finalized.filter((path) => path === '/a')).toHaveLength(1)
    expect(fixture.finalized.filter((path) => path === '/b')).toHaveLength(1)
    expect(fixture.finalized.filter((path) => path === '/c')).toHaveLength(0)
  })

  it('falls back to the main thread after a worker failure and destroys the pool', async () => {
    const fixture = makeInput()
    const destroy = vi.fn(async () => {})
    const workerRender = vi.fn(async () => {
      throw new Error('worker failed')
    })
    const fallback = vi.fn(
      async (
        path: string,
        _plan: RenderPlan,
        _error: unknown,
        _pool: RenderPoolLike,
      ) => resultFor(path),
    )
    fixture.input.onWorkerFailure = fallback
    const pool: RenderPoolLike = { render: workerRender, destroy }
    fixture.setPool(pool)
    fixture.input.destroyPool = async () => {
      await pool.destroy()
    }

    await executeRenderSchedule(fixture.input)

    expect(fallback).toHaveBeenCalledWith(
      '/b',
      expect.objectContaining({ path: '/b' }),
      expect.any(Error),
      pool,
    )
    expect(destroy).toHaveBeenCalled()
  })

  it('always drains and cleans up when finalization fails', async () => {
    const fixture = makeInput()
    const cleanup = vi.fn(async () => {})
    const drainWrites = vi.fn(async () => {})
    fixture.input.cleanupAfterFailure = cleanup
    fixture.input.drainWrites = drainWrites
    fixture.input.onWorkerResult = async () => {
      throw new Error('finalize failed')
    }
    fixture.setPool({
      render: async (path: string) => resultFor(path),
      destroy: async () => {},
    })

    await expect(executeRenderSchedule(fixture.input)).rejects.toThrow(
      'finalize failed',
    )
    expect(cleanup).toHaveBeenCalledOnce()
    expect(drainWrites).toHaveBeenCalled()
  })
})
