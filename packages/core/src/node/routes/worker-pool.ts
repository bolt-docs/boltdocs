import { Worker } from 'node:worker_threads'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ParsedDocFile } from './types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * A lightweight worker pool for parallel MDX metadata extraction.
 */
export class WorkerPool {
  private workers: Worker[] = []
  private queue: {
    task: any
    resolve: (val: any) => void
    reject: (err: any) => void
  }[] = []
  private activeWorkers = 0
  private maxWorkers: number
  private maxQueueSize: number

  /**
   * @param maxWorkers   - Maximum number of parallel worker threads (default: CPU count - 1).
   * @param maxQueueSize - Maximum number of tasks that can wait in the queue.
   *                       Prevents unbounded memory growth on very large doc sets.
   *                       Defaults to 2000 which comfortably covers most projects.
   */
  constructor(maxWorkers?: number, maxQueueSize = 2000) {
    this.maxWorkers = maxWorkers || Math.max(1, os.cpus().length - 1)
    this.maxQueueSize = maxQueueSize
  }

  private idleWorkers: Worker[] = []

  /**
   * Dispatches a file parsing task to an available worker.
   * Rejects immediately if the queue is full (back-pressure).
   */
  async parseFile(
    file: string,
    docsDir: string,
    basePath: string,
    config: any,
  ): Promise<ParsedDocFile> {
    if (this.queue.length >= this.maxQueueSize) {
      return Promise.reject(
        new Error(
          `[boltdocs] WorkerPool queue is full (limit: ${this.maxQueueSize}). ` +
            `Too many files enqueued simultaneously. Consider increasing maxQueueSize.`,
        ),
      )
    }
    return new Promise((resolve, reject) => {
      this.queue.push({
        task: { type: 'PARSE_FILE', file, docsDir, basePath, config },
        resolve,
        reject,
      })
      this.processNext()
    })
  }

  private processNext() {
    if (this.queue.length === 0) return

    let worker: Worker | undefined = this.idleWorkers.pop()

    if (!worker) {
      if (this.activeWorkers >= this.maxWorkers) return

      this.activeWorkers++
      const workerPath = this.getWorkerPath()
      const newWorker = new Worker(workerPath, {
        execArgv: workerPath.endsWith('.ts') ? ['--loader', 'tsx'] : [],
      })
      worker = newWorker
      this.workers.push(newWorker)

      newWorker.on('message', (response: any) => {
        const task = (newWorker as any).currentTask
        if (task) {
          (newWorker as any).currentTask = null
          if (response.type === 'SUCCESS') {
            task.resolve(response.result)
          } else {
            task.reject(new Error(response.error))
          }
        }
        this.idleWorkers.push(newWorker)
        this.processNext()
      })

      newWorker.on('error', (err) => {
        const task = (newWorker as any).currentTask
        if (task) {
          (newWorker as any).currentTask = null
          task.reject(err)
        }
        this.activeWorkers--
        const idleIndex = this.idleWorkers.indexOf(newWorker)
        if (idleIndex > -1) this.idleWorkers.splice(idleIndex, 1)
        const allIndex = this.workers.indexOf(newWorker)
        if (allIndex > -1) this.workers.splice(allIndex, 1)
        newWorker.terminate()
        this.processNext()
      })
    }

    const { task, resolve, reject } = this.queue.shift()!;
    (worker as any).currentTask = { resolve, reject }
    worker.postMessage(task)
  }

  private getWorkerPath(): string {
    const isDist =
      import.meta.url.includes('/dist/') ||
      path.extname(import.meta.url) === '.mjs'

    if (isDist) {
      // In dist, worker is usually at node/routes/worker.mjs relative to the bundle root
      // or at the same level as the chunk.
      const distPaths = [
        path.resolve(__dirname, 'node/routes/worker.mjs'),
        path.resolve(__dirname, 'worker.mjs'),
        path.resolve(__dirname, './node/routes/worker.mjs'),
      ]

      for (const p of distPaths) {
        if (fs.existsSync(p)) return p
      }

      // Final fallback for dist
      return path.resolve(__dirname, 'node/routes/worker.mjs')
    }

    // In development (src), worker is at the same level as worker-pool
    return path.resolve(__dirname, 'worker.ts')
  }

  async terminate() {
    const allWorkers = [...this.workers]
    await Promise.all(allWorkers.map((w) => w.terminate()))
    this.idleWorkers = []
    this.workers = []
    this.activeWorkers = 0
  }
}

// Singleton instance
export const pool = new WorkerPool()
