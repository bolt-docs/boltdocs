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

  constructor(maxWorkers?: number) {
    this.maxWorkers = maxWorkers || Math.max(1, os.cpus().length - 1)
  }

  private idleWorkers: Worker[] = []

  /**
   * Dispatches a file parsing task to an available worker.
   */
  async parseFile(
    file: string,
    docsDir: string,
    basePath: string,
    config: any,
  ): Promise<ParsedDocFile> {
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
      worker = new Worker(workerPath, {
        execArgv: workerPath.endsWith('.ts') ? ['--loader', 'tsx'] : [],
      })

      worker.on('error', (err) => {
        // If a task was running, it will be handled by the current task's reject
        // We need to cleanup and spawn a new one later if needed
        this.activeWorkers--
        const index = this.idleWorkers.indexOf(worker!)
        if (index > -1) this.idleWorkers.splice(index, 1)
        this.processNext()
      })
    }

    const { task, resolve, reject } = this.queue.shift()!

    const messageHandler = (response: any) => {
      worker!.off('message', messageHandler)
      worker!.off('error', errorHandler)

      if (response.type === 'SUCCESS') {
        resolve(response.result)
      } else {
        reject(new Error(response.error))
      }

      this.idleWorkers.push(worker!)
      this.processNext()
    }

    const errorHandler = (err: any) => {
      worker!.off('message', messageHandler)
      worker!.off('error', errorHandler)
      reject(err)
      // Worker is dead, don't reuse
      this.activeWorkers--
      this.processNext()
    }

    worker.once('message', messageHandler)
    worker.once('error', errorHandler)
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
    const allWorkers = [...this.idleWorkers]
    // Note: this doesn't track active workers that are currently busy
    // but in Boltdocs they are usually terminated when the process exits
    await Promise.all(allWorkers.map((w) => w.terminate()))
    this.idleWorkers = []
    this.activeWorkers = 0
  }
}

// Singleton instance
export const pool = new WorkerPool()
