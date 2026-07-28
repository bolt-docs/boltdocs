import Piscina from 'piscina'
import { cpus, freemem, totalmem } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  loaderData: Record<string, unknown> | null
  routerContextJSON: string | null
  _appHTMLBuffer?: ArrayBuffer
  _loaderDataBuffer?: ArrayBuffer
  _routerContextBuffer?: ArrayBuffer
}

export interface PoolOptions {
  numWorkers?: number
  ssrEntryPath: string
  format?: 'esm' | 'cjs'
}

/* ------------------------------------------------------------------ */
/*  Pool                                                               */
/* ------------------------------------------------------------------ */

export class SsgWorkerPool {
  private piscina: Piscina
  private totalWorkers: number
  private totalRendered = 0
  private totalErrors = 0
  private startTime: number

  constructor(options: PoolOptions) {
    const { ssrEntryPath, format = 'esm' } = options
    const cpuWorkers = Math.max(1, (cpus().length || 4) - 1)
    const freeGB = freemem() / 1024 / 1024 / 1024
    const totalGB = totalmem() / 1024 / 1024 / 1024
    const maxCap = totalGB >= 4 ? Math.min(cpuWorkers, 12) : 4
    const budgetWorkers = Math.max(2, Math.floor((totalGB * 0.35) / 0.256))
    const freeWorkers = Math.max(2, Math.floor(freeGB / 0.3))
    const ramWorkers = Math.min(budgetWorkers, freeWorkers)
    const requestedWorkers = options.numWorkers ?? cpuWorkers
    this.totalWorkers = Math.max(
      2,
      Math.min(requestedWorkers, cpuWorkers, ramWorkers, maxCap),
    )

    const workerFile = join(__dirname, 'ssg-worker.mjs')
    this.startTime = performance.now()

    this.piscina = new Piscina({
      filename: workerFile,
      workerData: { ssrEntryPath, format },
      maxThreads: this.totalWorkers,
      minThreads: this.totalWorkers,
      idleTimeout: 10000,
    })

    console.log(
      `[ssg-worker/piscina] Piscina pool initialized with ${this.totalWorkers} workers (RAM: ${totalGB.toFixed(1)} GB total, ${freeGB.toFixed(1)} GB free)`,
    )
  }

  async ready(): Promise<void> {
    return Promise.resolve()
  }

  async render(path: string): Promise<SsgRenderResult> {
    try {
      const res = (await this.piscina.run({ type: 'render', path })) as any
      this.totalRendered++
      if (res._appHTMLBuffer) {
        res.appHTML = Buffer.from(res._appHTMLBuffer as ArrayBuffer).toString(
          'utf-8',
        )
        delete res._appHTMLBuffer
      }
      if (res._routerContextBuffer) {
        res.routerContextJSON = Buffer.from(
          res._routerContextBuffer as ArrayBuffer,
        ).toString('utf-8')
        delete res._routerContextBuffer
      }
      return res as SsgRenderResult
    } catch (err) {
      this.totalErrors++
      throw err
    }
  }

  async destroy(): Promise<void> {
    await this.piscina.destroy()
  }

  poolMetrics() {
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
