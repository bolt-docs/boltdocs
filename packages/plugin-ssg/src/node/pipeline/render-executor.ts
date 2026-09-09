import type { SsgRenderResult } from '../ssg-worker-pool'
import {
  getRenderInFlightLimit,
  observeRenderTask,
} from '../render-scheduling-policy'
import { shouldEagerlyCreateRenderPool } from '../render-pool-policy'
import type { RenderPlan } from './render-plan'

export interface RenderPoolLike {
  render(path: string): Promise<SsgRenderResult>
  renderBatch?(
    paths: readonly string[],
  ): Promise<Array<SsgRenderResult | { path: string; error: string }>>
  destroy(): Promise<void>
}

export interface RenderExecutorInput {
  readonly routes: readonly string[]
  readonly canBypassClientBuild: boolean
  readonly getPlan: (path: string) => RenderPlan
  readonly isCached: (plan: RenderPlan) => boolean | Promise<boolean>
  readonly onCacheHit: (plan: RenderPlan) => Promise<void>
  readonly prepareRoute?: (plan: RenderPlan) => void | Promise<void>
  readonly ensurePool: () => Promise<void>
  readonly getPool: () => RenderPoolLike | null
  readonly onWorkerFailure: (
    path: string,
    plan: RenderPlan,
    error: unknown,
    pool: RenderPoolLike,
  ) => Promise<SsgRenderResult>
  readonly onWorkerResult: (
    path: string,
    plan: RenderPlan,
    result: SsgRenderResult,
    elapsedMs: number,
  ) => Promise<void>
  readonly batchSize?: number
  readonly scheduleMainThread: (path: string, plan: RenderPlan) => void
  readonly drainMainThread: () => Promise<void>
  readonly drainFinalizers: () => Promise<void>
  readonly drainWrites: () => Promise<void>
  readonly cleanupAfterFailure: () => Promise<void>
  readonly destroyPool: () => Promise<void>
  readonly getWorkerCount?: () => number
  readonly onNoRenderer?: (path: string) => void
}

export interface RenderExecutorResult {
  renderedCount: number
  cachedCount: number
  workerTaskCount: number
  usedWorker: boolean
}

type ObservedTask = Promise<
  { ok: true; value: void } | { ok: false; error: unknown }
>

function isBatchError(
  value: unknown,
  expectedPath?: string,
): value is { path: string; error: string } {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { path?: unknown }).path === 'string' &&
    typeof (value as { error?: unknown }).error === 'string' &&
    (expectedPath === undefined ||
      (value as { path: string }).path === expectedPath)
  )
}

function isRenderResult(
  value: unknown,
  expectedPath: string,
): value is SsgRenderResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<SsgRenderResult>
  return (
    result.path === expectedPath &&
    typeof result.appHTML === 'string' &&
    Array.isArray(result.metaAttributes) &&
    typeof result.bodyAttributes === 'string' &&
    typeof result.htmlAttributes === 'string' &&
    (result.routerContext === null ||
      (typeof result.routerContext === 'object' &&
        !Array.isArray(result.routerContext)))
  )
}

/** Execute the route render schedule with bounded worker backpressure. */
export async function executeRenderSchedule(
  input: RenderExecutorInput,
): Promise<RenderExecutorResult> {
  const workerTasks: ObservedTask[] = []
  const inFlight = new Set<ObservedTask>()
  let worker: RenderPoolLike | null = input.getPool()
  let workerLimit = getRenderInFlightLimit(
    worker ? (input.getWorkerCount?.() ?? 0) : 0,
  )
  let renderedCount = 0
  let cachedCount = 0
  let usedWorker = false

  const waitForWorkers = async (): Promise<void> => {
    if (workerTasks.length === 0) return
    const outcomes = await Promise.all(workerTasks)
    const failed = outcomes.find((outcome) => !outcome.ok)
    if (failed && !failed.ok) throw failed.error
  }

  const track = (task: Promise<void>): void => {
    let observed!: ObservedTask
    observed = observeRenderTask(task).finally(() => {
      inFlight.delete(observed)
    })
    workerTasks.push(observed)
    inFlight.add(observed)
  }

  try {
    if (
      shouldEagerlyCreateRenderPool(
        input.routes.length,
        input.canBypassClientBuild,
      )
    ) {
      await input.ensurePool()
      worker = input.getPool()
      if (worker) {
        workerLimit = getRenderInFlightLimit(input.getWorkerCount?.() ?? 0)
      }
    }

    if (worker?.renderBatch) {
      const uncached: Array<{ path: string; plan: RenderPlan }> = []
      for (const path of input.routes) {
        const plan = input.getPlan(path)
        if (await input.isCached(plan)) {
          await input.onCacheHit(plan)
          cachedCount++
        } else {
          await input.prepareRoute?.(plan)
          uncached.push({ path, plan })
        }
      }

      const batchSize = Math.max(
        2,
        input.batchSize ?? (input.getWorkerCount?.() ?? 1) * 2,
      )
      for (let offset = 0; offset < uncached.length; offset += batchSize) {
        const batch = uncached.slice(offset, offset + batchSize)
        if (!worker) {
          for (const { path, plan } of uncached.slice(offset)) {
            input.scheduleMainThread(path, plan)
            renderedCount++
          }
          break
        }

        usedWorker = true
        const workerForTask = worker
        const dispatchStart = performance.now()
        const recoverBatch = async (error: unknown): Promise<void> => {
          // Recover a failed Piscina task one page at a time. This is kept
          // separate from result processing so a write/finalizer failure does
          // not cause already-processed pages to render twice.
          for (const { path, plan } of batch) {
            const fallback = await input.onWorkerFailure(
              path,
              plan,
              error,
              workerForTask,
            )
            if (!isRenderResult(fallback, path)) {
              throw new Error('SSG fallback returned an invalid render result')
            }
            await input.onWorkerResult(
              path,
              plan,
              fallback,
              performance.now() - dispatchStart,
            )
            renderedCount++
          }
          worker = input.getPool()
        }

        const batchTask = (async (): Promise<void> => {
          let results: Array<SsgRenderResult | { path: string; error: string }>
          try {
            results = await workerForTask.renderBatch!(
              batch.map(({ path }) => path),
            )
          } catch (error) {
            await recoverBatch(error)
            return
          }

          if (!Array.isArray(results) || results.length !== batch.length) {
            await recoverBatch(
              new Error('SSG worker returned an invalid batch payload'),
            )
            return
          }

          for (let index = 0; index < batch.length; index++) {
            const { path, plan } = batch[index]
            const item = results[index]
            let result: SsgRenderResult
            if (isBatchError(item, path)) {
              result = await input.onWorkerFailure(
                path,
                plan,
                new Error(item.error),
                workerForTask,
              )
            } else if (isRenderResult(item, path)) {
              result = item
            } else {
              result = await input.onWorkerFailure(
                path,
                plan,
                new Error('SSG worker returned an invalid batch item'),
                workerForTask,
              )
            }

            if (!isRenderResult(result, path)) {
              throw new Error('SSG fallback returned an invalid render result')
            }
            await input.onWorkerResult(
              path,
              plan,
              result,
              performance.now() - dispatchStart,
            )
            renderedCount++
          }
          worker = input.getPool()
        })()

        track(batchTask)
        if (inFlight.size >= workerLimit) await Promise.race(inFlight)
      }
    } else {
      for (const path of input.routes) {
        const plan = input.getPlan(path)
        if (await input.isCached(plan)) {
          await input.onCacheHit(plan)
          cachedCount++
          continue
        }

        await input.prepareRoute?.(plan)
        if (!worker && input.routes.length > 4) {
          await input.ensurePool()
          worker = input.getPool()
          if (worker) {
            workerLimit = getRenderInFlightLimit(input.getWorkerCount?.() ?? 0)
          }
        }

        if (worker) {
          usedWorker = true
          const workerForTask = worker
          const dispatchStart = performance.now()
          const task = workerForTask
            .render(path)
            .catch(async (error) => {
              const fallback = await input.onWorkerFailure(
                path,
                plan,
                error,
                workerForTask,
              )
              worker = input.getPool()
              return fallback
            })
            .then(async (result) => {
              if (!isRenderResult(result, path)) {
                throw new Error('SSG worker returned an invalid render result')
              }
              await input.onWorkerResult(
                path,
                plan,
                result,
                performance.now() - dispatchStart,
              )
              renderedCount++
            })
          track(task)
          if (inFlight.size >= workerLimit) await Promise.race(inFlight)
        } else {
          input.scheduleMainThread(path, plan)
          renderedCount++
        }
      }
    }

    await waitForWorkers()
    await input.drainFinalizers()
    await input.drainMainThread()
    await input.drainWrites()

    return {
      renderedCount,
      cachedCount,
      workerTaskCount: workerTasks.length,
      usedWorker,
    }
  } catch (error) {
    await Promise.all(workerTasks)
    await input.drainFinalizers()
    await input.drainMainThread()
    await input.drainWrites()
    await input.cleanupAfterFailure()
    throw error
  } finally {
    await input.destroyPool()
  }
}
