import Piscina from 'piscina'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface CompileRequest {
  sourceCode: string
  filePath: string
}

export interface CompileResult {
  compiledCode: string
  filePath: string
  success: boolean
  error?: string
}

export interface PoolMetrics {
  totalJobs: number
  successfulJobs: number
  failedJobs: number
  totalTimeMs: number
  activeWorkers: number
  healthyWorkers: number
}

export class CompilePool {
  private piscina: Piscina
  private totalWorkers: number
  private totalJobs = 0
  private failedJobs = 0
  private startTime = 0
  private _terminated = false

  constructor(numWorkers?: number) {
    this.totalWorkers = numWorkers ?? Math.max(2, (os.cpus().length || 2) - 1)
    const workerFile = join(__dirname, 'compile-worker.mjs')
    this.startTime = performance.now()

    this.piscina = new Piscina({
      filename: workerFile,
      maxThreads: this.totalWorkers,
      minThreads: this.totalWorkers,
      idleTimeout: 30000,
    })
  }

  async start(): Promise<void> {
    this._terminated = false
    return Promise.resolve()
  }

  async compile(request: CompileRequest): Promise<CompileResult> {
    if (this._terminated) {
      throw new Error('[compile-pool] Pool already terminated')
    }
    this.totalJobs++
    try {
      const res = (await this.piscina.run(request)) as CompileResult
      if (!res.success) this.failedJobs++
      return res
    } catch (err) {
      this.failedJobs++
      return {
        compiledCode: '',
        filePath: request.filePath,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  async terminate(): Promise<void> {
    this._terminated = true
    await this.piscina.destroy()
  }

  get metrics(): PoolMetrics {
    return {
      totalJobs: this.totalJobs,
      successfulJobs: this.totalJobs - this.failedJobs,
      failedJobs: this.failedJobs,
      totalTimeMs: Math.round(performance.now() - this.startTime),
      activeWorkers: this.totalWorkers,
      healthyWorkers: this.totalWorkers,
    }
  }

  get terminated(): boolean {
    return this._terminated
  }
}
