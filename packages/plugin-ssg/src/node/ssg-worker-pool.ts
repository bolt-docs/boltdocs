import Piscina from 'piscina'
import { cpus, freemem, totalmem } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RouterContextData } from '../router-contract'
import type { RouterRenderTimings } from './router-adapter/interface'
import { decodeSsgText } from './ssg-worker-payload'
import { resolveSsgWorkerCount } from './worker-count-policy'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SsgRenderResult {
  path: string
  appHTML: string
  metaAttributes: string[]
  bodyAttributes: string
  htmlAttributes: string
  styleTag: string | undefined
  routerContext: RouterContextData | null
  timings?: RouterRenderTimings
}

export interface SsgBatchError {
  path: string
  error: string
}

export type SsgBatchResult = SsgRenderResult | SsgBatchError

type RawSsgRenderResult = Partial<SsgRenderResult> & {
  _appHTMLBuffer?: ArrayBuffer | ArrayBufferView<ArrayBufferLike>
  _routerContextBuffer?: ArrayBuffer | ArrayBufferView<ArrayBufferLike>
}

function isSsgBatchError(value: unknown): value is SsgBatchError {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { path?: unknown }).path === 'string' &&
    typeof (value as { error?: unknown }).error === 'string'
  )
}

export interface PoolOptions {
  numWorkers?: number
  ssrEntryPath: string
  format?: 'esm' | 'cjs'
}

export interface SsgPoolMetrics {
  totalWorkers: number
  readyCount: number
  busyCount: number
  pagesPerWorker: number[]
  initTimesMs: number[]
  totalRendered: number
  totalErrors: number
  allReadyMs: number
  failedCount: number
}

/* ------------------------------------------------------------------ */
/*  Pool                                                               */
/* ------------------------------------------------------------------ */

export class SsgWorkerPool {
  private piscina: Piscina
  private totalWorkers: number
  private totalRendered = 0
  private totalErrors = 0
  private destroyPromise: Promise<void> | null = null
  private startTime: number

  constructor(options: PoolOptions) {
    const { ssrEntryPath, format = 'esm' } = options
    const freeGB = freemem() / 1024 / 1024 / 1024
    const totalGB = totalmem() / 1024 / 1024 / 1024
    this.totalWorkers = resolveSsgWorkerCount({
      cpuCount: cpus().length || 4,
      totalMemoryGB: totalGB,
      freeMemoryGB: freeGB,
      requestedWorkers: options.numWorkers,
      envWorkers: process.env.BOLTDOCS_SSG_WORKERS,
    })

    const workerFile = join(__dirname, 'ssg-worker.mjs')
    this.startTime = performance.now()

    this.piscina = new Piscina({
      filename: workerFile,
      workerData: { ssrEntryPath, format },
      maxThreads: this.totalWorkers,
      // Start workers on demand for the first render task. This preserves the
      // same concurrency ceiling while avoiding eager SSR runtime creation on
      // builds that render few pages or fail before dispatch.
      minThreads: 0,
      idleTimeout: 10000,
    })

    console.log(
      `[ssg-worker/piscina] Piscina pool initialized with ${this.totalWorkers} workers (RAM: ${totalGB.toFixed(1)} GB total, ${freeGB.toFixed(1)} GB free)`,
    )
  }

  async ready(): Promise<void> {
    return Promise.resolve()
  }

  private decodeResult(
    raw: RawSsgRenderResult,
    expectedPath: string,
  ): SsgRenderResult {
    if (!raw || typeof raw !== 'object' || raw.path !== expectedPath) {
      throw new Error('SSG worker returned an invalid render payload')
    }
    raw.routerContext = raw.routerContext ?? null
    if (raw._appHTMLBuffer) {
      raw.appHTML = decodeSsgText(raw._appHTMLBuffer)
      delete raw._appHTMLBuffer
    }
    if (
      raw._routerContextBuffer ||
      typeof raw.appHTML !== 'string' ||
      !Array.isArray(raw.metaAttributes) ||
      typeof raw.bodyAttributes !== 'string' ||
      typeof raw.htmlAttributes !== 'string' ||
      (raw.routerContext !== null &&
        (typeof raw.routerContext !== 'object' ||
          Array.isArray(raw.routerContext)))
    ) {
      throw new Error('SSG worker returned an invalid render payload')
    }
    return raw as SsgRenderResult
  }

  async render(path: string): Promise<SsgRenderResult> {
    try {
      const result = this.decodeResult(
        (await this.piscina.run({
          type: 'render',
          path,
        })) as RawSsgRenderResult,
        path,
      )
      this.totalRendered++
      return result
    } catch (err) {
      this.totalErrors++
      throw err
    }
  }

  async renderBatch(paths: readonly string[]): Promise<SsgBatchResult[]> {
    if (paths.length === 0) return []
    try {
      const rawResults = (await this.piscina.run({
        type: 'render-batch',
        paths: [...paths],
      })) as Array<RawSsgRenderResult | SsgBatchError>
      if (!Array.isArray(rawResults) || rawResults.length !== paths.length) {
        throw new Error('SSG worker returned an invalid batch payload')
      }
      const results = rawResults.map((raw, index) => {
        if (isSsgBatchError(raw)) return raw
        if (!raw || typeof raw !== 'object') {
          throw new Error('SSG worker returned an invalid batch item')
        }
        return this.decodeResult(raw, paths[index])
      })
      this.totalRendered += results.filter(
        (result) => !isSsgBatchError(result),
      ).length
      this.totalErrors += results.filter(isSsgBatchError).length
      return results
    } catch (err) {
      this.totalErrors++
      throw err
    }
  }

  async destroy(): Promise<void> {
    if (this.destroyPromise) return this.destroyPromise

    this.destroyPromise = this.piscina.destroy()
    await this.destroyPromise
  }

  poolMetrics(): SsgPoolMetrics {
    return {
      totalWorkers: this.totalWorkers,
      readyCount: this.totalWorkers,
      busyCount: this.piscina.completed,
      pagesPerWorker: [],
      initTimesMs: [],
      totalRendered: this.totalRendered,
      totalErrors: this.totalErrors,
      allReadyMs: Math.round(performance.now() - this.startTime),
      failedCount: 0,
    }
  }
}
