import { Worker } from 'node:worker_threads'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { FormatEnum } from 'sharp'
import type { Config as SVGOConfig } from 'svgo'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAX_QUEUE = 500

interface OptimizeTask {
  filePath: string
  buffer: Buffer
  formatOptions: Record<string, unknown>
  svgOptions: SVGOConfig
}

interface PendingTask {
  resolve: (val: Buffer) => void
  reject: (err: Error) => void
}

export class ImageWorkerPool {
  private workers: Worker[] = []
  private idle: Worker[] = []
  private active = 0
  private maxWorkers: number
  private taskQueue: {
    task: OptimizeTask
    resolve: (val: Buffer) => void
    reject: (err: Error) => void
  }[] = []
  private pending = new Map<Worker, PendingTask>()

  constructor(maxWorkers?: number) {
    this.maxWorkers = maxWorkers || Math.max(1, os.cpus().length - 1)
  }

  async optimize(task: OptimizeTask): Promise<Buffer> {
    if (this.taskQueue.length >= MAX_QUEUE) {
      return this.optimizeInline(task)
    }
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject })
      this.processNext()
    })
  }

  private async optimizeInline(task: OptimizeTask): Promise<Buffer> {
    if (/\.svg$/.test(task.filePath)) {
      const { optimize } = await import('svgo')
      return Buffer.from(
        optimize(task.buffer.toString(), {
          path: task.filePath,
          ...task.svgOptions,
        }).data,
      )
    }
    const sharp = (await import('sharp')).default
    const ext = path.extname(task.filePath).replace('.', '').toLowerCase()
    return await sharp(task.buffer, { animated: ext === 'gif' })
      .toFormat(ext as keyof FormatEnum, task.formatOptions)
      .toBuffer()
  }

  private processNext() {
    if (this.taskQueue.length === 0) return

    let worker = this.idle.pop()

    if (!worker) {
      if (this.active >= this.maxWorkers) return
      this.active++
      worker = this.spawn()
      this.workers.push(worker)
    }

    const { task, resolve, reject } = this.taskQueue.shift()!
    this.pending.set(worker, { resolve, reject })
    worker.postMessage({
      type: 'OPTIMIZE_IMAGE',
      filePath: task.filePath,
      buffer: task.buffer,
      formatOptions: task.formatOptions,
      svgOptions: task.svgOptions,
    })
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
        pending.resolve(Buffer.from(response.buffer))
      } else {
        pending.reject(
          new Error(response.error || 'Worker optimization failed'),
        )
      }
      this.idle.push(w)
      this.processNext()
    })

    const cleanup = (err?: Error) => {
      const idx = this.workers.indexOf(w)
      if (idx === -1) return
      const pending = this.pending.get(w)
      if (pending) {
        this.pending.delete(w)
        pending.reject(err || new Error('Worker terminated unexpectedly'))
      }
      this.active--
      const idleIdx = this.idle.indexOf(w)
      if (idleIdx > -1) this.idle.splice(idleIdx, 1)
      this.workers.splice(idx, 1)
      w.terminate()
      this.processNext()
    }

    w.on('error', (err) => cleanup(err))
    w.on('exit', (code) => {
      if (code !== 0) cleanup(new Error(`Worker exited with code ${code}`))
    })

    return w
  }

  private getWorkerPath(): string {
    const isDist =
      import.meta.url.includes('/dist/') ||
      path.extname(import.meta.url) === '.mjs'
    if (isDist) {
      const distPaths = [
        path.resolve(__dirname, 'worker.mjs'),
        path.resolve(__dirname, './worker.mjs'),
      ]
      for (const p of distPaths) {
        if (fs.existsSync(p)) return p
      }
      return path.resolve(__dirname, 'worker.mjs')
    }
    return path.resolve(__dirname, 'worker.ts')
  }

  async terminate() {
    const all = [...this.workers]
    await Promise.all(all.map((w) => w.terminate()))
    this.idle = []
    this.workers = []
    this.active = 0
  }
}
