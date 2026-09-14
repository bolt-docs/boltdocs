import { Worker } from 'node:worker_threads'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const WORKER_PATH = join(__dirname, 'worker.mjs')

function defaultConcurrency() {
  try {
    return Math.max(1, Math.min(availableParallelism(), 8))
  } catch {
    return Math.max(1, Math.min(4, 8))
  }
}

/**
 * Worker-thread pool for zig-critters.
 *
 * Why a pool: the WASM instance is process-global with shared memory, so the
 * previous serial wrapper could only run one extraction at a time. Each pool
 * worker owns a private WASM instance, giving true parallel extraction while
 * keeping per-instance calls serialized.
 *
 * All methods are fire-and-forget safe: rejections propagate to the caller of
 * the failing extraction only.
 */
export class ZigCrittersPool {
  #workers = []
  #idle = []
  #waiters = []
  #pending = new Map()
  #nextId = 1
  #closed = false
  #concurrency

  constructor(options = {}) {
    this.#concurrency = Math.max(
      1,
      Math.min(options.concurrency ?? defaultConcurrency(), 16),
    )
  }

  /** Number of workers (spawned lazily on first use). */
  get concurrency() {
    return this.#concurrency
  }

  #spawn() {
    const worker = new Worker(WORKER_PATH)
    const entry = { worker, busy: false }
    this.#workers.push(entry)

    worker.unref()

    worker.on('message', (msg) => {
      if (!msg || msg.type !== 'result') return
      const pending = this.#pending.get(msg.id)
      this.#pending.delete(msg.id)
      entry.busy = false
      this.#idle.push(entry)
      this.#dispatch()
      if (!pending) return
      if (msg.error) {
        pending.reject(new Error(`zig-critters worker: ${msg.error}`))
      } else {
        pending.resolve(msg.result)
      }
    })

    worker.on('error', (error) => {
      this.#failEntry(entry, error)
    })

    worker.on('exit', (code) => {
      if (code !== 0) {
        this.#failEntry(entry, new Error(`zig-critters worker exited: ${code}`))
      } else {
        // Normal shutdown: drop it from the idle list; callers waiting on it
        // are rejected below by close().
        this.#removeIdle(entry)
      }
    })

    return entry
  }

  #removeIdle(entry) {
    const idx = this.#idle.indexOf(entry)
    if (idx !== -1) this.#idle.splice(idx, 1)
  }

  #failEntry(entry, error) {
    // Fail every in-flight request on this worker so callers do not hang.
    for (const [id, pending] of this.#pending) {
      if (pending.entry === entry) {
        this.#pending.delete(id)
        pending.reject(
          error instanceof Error ? error : new Error(String(error)),
        )
      }
    }
    entry.busy = false
    this.#removeIdle(entry)
    const workerIdx = this.#workers.indexOf(entry)
    if (workerIdx !== -1) this.#workers.splice(workerIdx, 1)
    this.#dispatch()
  }

  #dispatch() {
    while (this.#waiters.length > 0 && this.#idle.length > 0) {
      const waiter = this.#waiters.shift()
      const entry = this.#idle.pop()
      entry.busy = true
      waiter(entry)
    }
  }

  #acquire() {
    return new Promise((resolve) => {
      this.#waiters.push(resolve)
      this.#dispatch()
    })
  }

  /**
   * Extract critical CSS for one page.
   * Mirrors the serial API: `{ criticalCss, stats }`.
   */
  async extractCriticalCss(html, css, options = {}) {
    if (this.#closed) {
      throw new Error('zig-critters pool is closed')
    }

    while (
      this.#workers.length < this.#concurrency &&
      this.#idle.length === 0
    ) {
      this.#spawn()
      this.#idle.push(this.#workers[this.#workers.length - 1])
    }

    const entry = await this.#acquire()
    if (!entry) {
      // Pool was closed while this caller waited for a worker.
      throw new Error('zig-critters pool closed')
    }
    const id = this.#nextId++

    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, entry })
      try {
        entry.worker.postMessage({ type: 'extract', id, html, css, options })
      } catch (error) {
        this.#pending.delete(id)
        entry.busy = false
        this.#idle.push(entry)
        reject(error)
      }
    })
  }

  /**
   * Shut the pool down. Resolves when all workers exited; pending extractions
   * are rejected.
   */
  async close() {
    if (this.#closed) return
    this.#closed = true

    const exitPromises = this.#workers.map(
      (entry) =>
        new Promise((resolve) => {
          if (!entry.worker) return resolve()
          entry.worker.once('exit', () => resolve())
          entry.worker.terminate()
        }),
    )

    for (const waiter of this.#waiters) {
      waiter(null)
    }
    this.#waiters.length = 0

    for (const [, pending] of this.#pending) {
      pending.reject(new Error('zig-critters pool closed'))
    }
    this.#pending.clear()
    this.#idle.length = 0
    this.#workers.length = 0

    await Promise.all(exitPromises)
  }
}

/**
 * Create a pool with the given (or default) concurrency.
 * Returns null when worker threads are unavailable so callers can fall back
 * to the serial API.
 */
export function createZigCrittersPool(options = {}) {
  try {
    return new ZigCrittersPool(options)
  } catch {
    return null
  }
}
