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
  private queue: { task: any; resolve: (val: any) => void; reject: (err: any) => void }[] = []
  private activeWorkers = 0
  private maxWorkers: number

  constructor(maxWorkers?: number) {
    this.maxWorkers = maxWorkers || Math.max(1, os.cpus().length - 1)
  }

  /**
   * Dispatches a file parsing task to an available worker.
   */
  async parseFile(
    file: string,
    docsDir: string,
    basePath: string,
    config: any
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
    if (this.activeWorkers >= this.maxWorkers || this.queue.length === 0) return

    this.activeWorkers++
    const { task, resolve, reject } = this.queue.shift()!

    // Determine worker path (support both src and dist)
    const workerPath = this.getWorkerPath()
    const worker = new Worker(workerPath)

    worker.on('message', (response) => {
      if (response.type === 'SUCCESS') {
        resolve(response.result)
      } else {
        reject(new Error(response.error))
      }
      worker.terminate()
      this.activeWorkers--
      this.processNext()
    })

    worker.on('error', (err) => {
      reject(err)
      worker.terminate()
      this.activeWorkers--
      this.processNext()
    })

    worker.postMessage(task)
  }

  private getWorkerPath(): string {
    const isDist = import.meta.url.includes('/dist/') || path.extname(import.meta.url) === '.mjs'
    
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
    // Current implementation creates/terminates workers per task for simplicity
    // A more persistent pool would be faster but more complex to manage
  }
}

// Singleton instance
export const pool = new WorkerPool()
