import { Worker } from 'node:worker_threads'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface MdxTransformTask {
  code: string
  id: string
  docsDir: string
  root: string
  command: string
  mode: string
}

interface PendingTask {
  resolve: (code: string) => void
  reject: (err: Error) => void
}

export class MdxWorkerPool {
  private workers: Worker[] = []
  private idle: Worker[] = []
  private active = 0
  private readonly maxWorkers: number
  private taskQueue: {
    task: MdxTransformTask
    resolve: (code: string) => void
    reject: (err: Error) => void
  }[] = []
  private pending = new Map<Worker, PendingTask>()
  private terminating = false

  constructor(maxWorkers?: number) {
    this.maxWorkers = maxWorkers || Math.max(1, os.cpus().length - 1)
  }

  async transform(task: MdxTransformTask): Promise<string> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject })
      this.processNext()
    })
  }

  async terminate() {
    this.terminating = true

    // Reject any tasks still waiting in the queue — they will never be processed.
    const queued = this.taskQueue
    this.taskQueue = []
    for (const { reject } of queued) {
      reject(new Error('MDX worker pool terminated before transform could run'))
    }

    const all = [...this.workers]
    await Promise.all(all.map((w) => w.terminate()))
    this.idle = []
    this.workers = []
    this.active = 0
  }

  private processNext() {
    if (this.taskQueue.length === 0) return
    if (this.terminating) return

    let worker = this.idle.pop()

    if (!worker) {
      if (this.active >= this.maxWorkers) return
      this.active++
      worker = this.spawn()
      this.workers.push(worker)
    }

    const { task, resolve, reject } = this.taskQueue.shift()!
    this.pending.set(worker, { resolve, reject })
    worker.postMessage(task)
  }

  private spawn(): Worker {
    const workerPath = this.getWorkerPath()
    const useLoader = workerPath.endsWith('.ts')
    const w = new Worker(workerPath, {
      execArgv: useLoader ? ['--import', 'tsx'] : [],
    })

    w.on('message', (response: any) => {
      const pending = this.pending.get(w)
      if (!pending) return
      this.pending.delete(w)

      if (response.type === 'SUCCESS') {
        pending.resolve(response.code)
      } else {
        pending.reject(
          new Error(response.error || 'MDX worker transform failed'),
        )
      }

      if (!this.terminating) {
        this.idle.push(w)
        this.processNext()
      }
    })

    const cleanup = (err?: Error) => {
      const idx = this.workers.indexOf(w)
      if (idx === -1) return

      const pending = this.pending.get(w)
      if (pending) {
        this.pending.delete(w)
        pending.reject(err || new Error('MDX worker terminated unexpectedly'))
      }

      this.active--
      const idleIdx = this.idle.indexOf(w)
      if (idleIdx > -1) this.idle.splice(idleIdx, 1)
      this.workers.splice(idx, 1)
      w.terminate()

      if (!this.terminating) {
        this.processNext()
      }
    }

    w.on('error', (err) => cleanup(err))
    w.on('exit', (code) => {
      if (code !== 0) cleanup(new Error(`MDX worker exited with code ${code}`))
    })

    return w
  }

  private getWorkerPath(): string {
    // Prefer the compiled worker when it exists (production / installed package).
    const distPath = path.resolve(__dirname, 'worker.mjs')
    if (fs.existsSync(distPath)) {
      return distPath
    }
    // Otherwise we are running from source and need tsx to compile it on the fly.
    return path.resolve(__dirname, 'worker.ts')
  }
}
