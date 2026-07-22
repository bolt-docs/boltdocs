import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { LRUCache } from 'lru-cache'
import { getFileMtime, getCacheConfig } from './utils'

const writeFile = fsPromises.writeFile
const readFile = fsPromises.readFile
const mkdir = fsPromises.mkdir
const rename = fsPromises.rename
const gzipPromise = promisify(zlib.gzip)
const gunzipPromise = promisify(zlib.gunzip)

/**
 * Shards directory name.
 */
const SHARDS_DIR = 'shards'

/**
 * Simple background task queue to prevent blocking the main thread during IO.
 */
class BackgroundQueue {
  private activeTasks = new Set<Promise<void>>()

  add(task: () => Promise<void>) {
    const promise = Promise.resolve()
      .then(task)
      .catch(() => {})
      .finally(() => {
        this.activeTasks.delete(promise)
      })
    this.activeTasks.add(promise)
  }

  async flush() {
    await Promise.all(Array.from(this.activeTasks))
  }

  get pending() {
    return this.activeTasks.size
  }
}

export const globalBackgroundQueue = new BackgroundQueue()

/**
 * Run an array of tasks with bounded concurrency.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let index = 0

  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return results
}

/**
 * Generic file-based cache with per-file granularity and asynchronous persistence.
 *
 * Storage layout (when `name` is provided):
 *   <root>/.boltdocs/cache/file-<name>/index.json
 *   <root>/.boltdocs/cache/file-<name>/shards/<hash>.json[.gz]
 *
 * Each entry is persisted in its own shard keyed by a hash of the serialized
 * value. This avoids the monolithic JSON.parse/stringify overhead of the
 * previous single-file implementation and mirrors the proven design of
 * `TransformCache`.
 */
export class FileCache<T> {
  private entries = new Map<string, { data: T; mtime: number }>()
  private readonly baseDir: string | null = null
  private readonly indexPath: string | null = null
  private readonly shardsDir: string | null = null
  private readonly compress: boolean
  private loaded = false
  private savePromise: Promise<void> | null = null

  constructor(
    options: { name?: string; root?: string; compress?: boolean } = {},
  ) {
    const config = getCacheConfig()
    this.compress =
      options.compress !== undefined ? options.compress : config.compress
    if (options.name) {
      const root = options.root || process.cwd()
      this.baseDir = path.resolve(root, config.dir, `file-${options.name}`)
      this.indexPath = path.resolve(this.baseDir, 'index.json')
      this.shardsDir = path.resolve(this.baseDir, 'shards')
    }
  }

  private shardHash(data: T): string {
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
  }

  private shardPath(hash: string): string {
    const ext = this.compress ? 'gz' : 'json'
    return path.resolve(this.shardsDir!, `${hash}.${ext}`)
  }

  /**
   * Loads the cache index and shards into memory.
   */
  async load(): Promise<void> {
    if (this.loaded) return
    const config = getCacheConfig()
    if (config.noCache) return
    if (!this.indexPath || !this.shardsDir) return

    let index: Record<string, { hash: string; mtime: number }> = {}
    try {
      const raw = await readFile(this.indexPath, 'utf-8')
      index = JSON.parse(raw)
    } catch (e) {
      if (
        e instanceof Error &&
        (e as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        this.loaded = true
        return
      }
      // Corrupt or unreadable index; start fresh
      this.loaded = true
      return
    }

    const entries = new Map<string, { data: T; mtime: number }>()
    const keys = Object.keys(index)

    await runWithConcurrency(keys, 32, async (key) => {
      const { hash, mtime } = index[key]
      const shardPath = this.shardPath(hash)
      try {
        let raw = await readFile(shardPath)
        if (this.compress) {
          raw = await gunzipPromise(
            new Uint8Array(raw as Buffer) as unknown as Parameters<
              typeof gunzipPromise
            >[0],
          )
        }
        const data = JSON.parse(raw.toString('utf-8')) as T
        entries.set(key, { data, mtime })
      } catch {
        // Ignore missing/corrupt shards; they will be regenerated
      }
    })

    this.entries = entries
    this.loaded = true
  }

  /**
   * Saves the cache in the background using a sharded index + shard files.
   */
  save(): void {
    const config = getCacheConfig()
    if (config.noCache) return
    if (!this.indexPath || !this.shardsDir) return

    // Snapshot the current in-memory state so this save task is self-consistent
    const snapshot = Array.from(this.entries.entries()).map(([key, value]) => ({
      key,
      ...value,
      hash: this.shardHash(value.data),
    }))

    const index: Record<string, { hash: string; mtime: number }> = {}
    for (const { key, mtime, hash } of snapshot) {
      index[key] = { hash, mtime }
    }

    const indexTarget = this.indexPath
    const indexData = JSON.stringify(index)
    const useCompress = this.compress
    const shardsDir = this.shardsDir
    const activeHashes = new Set(Object.values(index).map((i) => i.hash))

    // Chain saves on this instance so two overlapping saves never race on the
    // shard directory. Each save still writes via the global background queue.
    const run = async () => {
      try {
        await mkdir(shardsDir, { recursive: true })

        // Write the index first so a crash never leaves an index pointing to missing shards
        const tempIndexPath = `${indexTarget}.${crypto.randomBytes(4).toString('hex')}.tmp`
        await writeFile(tempIndexPath, indexData)
        await rename(tempIndexPath, indexTarget)

        // Write each unique content shard with bounded concurrency
        const uniqueShards = new Map<string, T>()
        for (const { hash, data } of snapshot) {
          if (!uniqueShards.has(hash)) {
            uniqueShards.set(hash, data)
          }
        }

        await runWithConcurrency(
          Array.from(uniqueShards.entries()),
          8,
          async ([hash, data]) => {
            const target = this.shardPath(hash)
            try {
              await fsPromises.access(target)
              return
            } catch {
              // File does not exist, proceed to write
            }

            const content = JSON.stringify(data)
            let buffer: any = Buffer.from(content)
            if (useCompress) {
              buffer = await gzipPromise(buffer)
            }
            const tempPath = `${target}.${crypto.randomBytes(4).toString('hex')}.tmp`
            await writeFile(tempPath, buffer)
            await rename(tempPath, target)
          },
        )

        // Prune orphan shards that are no longer referenced by the index.
        // This runs after the index is persisted so the index is never stale.
        try {
          const files = await fsPromises.readdir(shardsDir)
          await runWithConcurrency(files, 8, async (file) => {
            const hash = file.replace(/\.(gz|json)$/, '')
            if (!activeHashes.has(hash)) {
              await fsPromises.unlink(path.resolve(shardsDir, file))
            }
          })
        } catch {
          // Ignore prune errors
        }
      } catch (e) {
        // Fallback: critical error logging skipped for performance
      }
    }

    this.savePromise = (this.savePromise || Promise.resolve()).then(run, run)
    globalBackgroundQueue.add(() => this.savePromise!)
  }

  get(filePath: string): T | null {
    const entry = this.entries.get(filePath)
    if (!entry) return null
    if (getFileMtime(filePath) !== entry.mtime) return null
    return entry.data
  }

  getStale(filePath: string): T | null {
    const entry = this.entries.get(filePath)
    return entry ? entry.data : null
  }

  set(filePath: string, data: T): void {
    this.entries.set(filePath, {
      data,
      mtime: getFileMtime(filePath),
    })
  }

  isValid(filePath: string): boolean {
    const entry = this.entries.get(filePath)
    if (!entry) return false
    return getFileMtime(filePath) === entry.mtime
  }

  invalidate(filePath: string): void {
    this.entries.delete(filePath)
  }

  invalidateAll(): void {
    this.entries.clear()
    this.loaded = false
  }

  pruneStale(currentFiles: Set<string>): void {
    for (const key of this.entries.keys()) {
      if (!currentFiles.has(key)) {
        this.entries.delete(key)
      }
    }
  }

  get size(): number {
    return this.entries.size
  }

  async flush() {
    await globalBackgroundQueue.flush()
  }
}

/**
 * Sharded Cache: Optimized for large-scale data (like MDX transformations).
 * Uses a memory index and individual files for each entry to avoid massive JSON parsing.
 */
export class TransformCache {
  private index = new Map<string, string>() // key -> hash
  private memoryCache: LRUCache<string, string>
  private readonly baseDir: string
  private readonly shardsDir: string
  private readonly indexPath: string
  private saveTimeout: NodeJS.Timeout | null = null

  constructor(name: string, root: string = process.cwd()) {
    const config = getCacheConfig()
    this.baseDir = path.resolve(root, config.dir, `transform-${name}`)
    this.shardsDir = path.resolve(this.baseDir, SHARDS_DIR)
    this.indexPath = path.resolve(this.baseDir, 'index.json')
    this.memoryCache = new LRUCache<string, string>({
      max: config.lruLimit,
      ttl: config.lruTTL,
      updateAgeOnGet: true,
    })
  }

  /**
   * Loads the index into memory.
   */
  async load(): Promise<void> {
    const config = getCacheConfig()
    if (config.noCache) return

    try {
      const data = await readFile(this.indexPath, 'utf-8')
      this.index = new Map(Object.entries(JSON.parse(data)))
    } catch (e) {
      if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT')
        return
      // Index might be corrupt, ignore
    }
  }

  /**
   * Persists the index in background.
   */
  save(): void {
    const config = getCacheConfig()
    if (config.noCache) return
    const data = JSON.stringify(Object.fromEntries(this.index))
    const target = this.indexPath

    globalBackgroundQueue.add(async () => {
      try {
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, data)
      } catch (e) {
        // Ignore save errors
      }
    })
  }

  /**
   * Batch Read: Retrieves multiple transformation results concurrently.
   */
  async getMany(keys: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>()
    const toLoad: string[] = []

    for (const key of keys) {
      const mem = this.memoryCache.get(key)
      if (mem) results.set(key, mem)
      else if (this.index.has(key)) toLoad.push(key)
    }

    if (toLoad.length > 0) {
      const shards = await Promise.all(
        toLoad.map(async (key) => {
          const hash = this.index.get(key)!
          const shardPath = path.resolve(this.shardsDir, `${hash}.gz`)
          try {
            const compressed = await readFile(shardPath)
            const decompressedBuffer = await gunzipPromise(
              new Uint8Array(compressed as Buffer) as unknown as Parameters<
                typeof gunzipPromise
              >[0],
            )
            const decompressed = decompressedBuffer.toString('utf-8')
            this.memoryCache.set(key, decompressed)
            return { key, val: decompressed }
          } catch (e) {
            return null
          }
        }),
      )

      for (const s of shards) {
        if (s) results.set(s.key, s.val)
      }
    }

    return results
  }

  /**
   * Retrieves a cached transformation asynchronously. Fast lookup via index, lazy loading from disk.
   */
  async getAsync(key: string): Promise<string | null> {
    const mem = this.memoryCache.get(key)
    if (mem) return mem

    const hash = this.index.get(key)
    if (!hash) return null

    const shardPath = path.resolve(this.shardsDir, `${hash}.gz`)
    try {
      const compressed = await readFile(shardPath)
      const decompressedBuffer = await gunzipPromise(compressed as any)
      const decompressed = decompressedBuffer.toString('utf-8')
      this.memoryCache.set(key, decompressed)
      return decompressed
    } catch (e) {
      if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT')
        return null
      return null
    }
  }

  /**
   * Stores a transformation result.
   */
  set(key: string, result: string): void {
    const hash = crypto.createHash('md5').update(result).digest('hex')
    this.index.set(key, hash)
    this.memoryCache.set(key, result)

    const shardPath = path.resolve(this.shardsDir, `${hash}.gz`)

    // Background write shard
    globalBackgroundQueue.add(async () => {
      try {
        try {
          await fsPromises.access(shardPath)
          return // Already exists
        } catch {
          // File does not exist, proceed to create
        }
        await mkdir(this.shardsDir, { recursive: true })

        const compressed = await gzipPromise(
          new Uint8Array(Buffer.from(result)) as unknown as Parameters<
            typeof gzipPromise
          >[0],
        )
        const tempPath = `${shardPath}.${crypto.randomBytes(4).toString('hex')}.tmp`
        await writeFile(
          tempPath,
          new Uint8Array(compressed as Buffer) as unknown as Parameters<
            typeof writeFile
          >[1],
        )
        await rename(tempPath, shardPath)
      } catch (e) {
        // Ignore shard write errors
      }
    })

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }
    this.saveTimeout = setTimeout(() => {
      this.save()
    }, 500)
    if (typeof this.saveTimeout.unref === 'function') {
      this.saveTimeout.unref()
    }
  }

  get size() {
    return this.index.size
  }

  async flush() {
    await globalBackgroundQueue.flush()
  }
}

/**
 * Flushes all pending background cache operations.
 */
export async function flushCache() {
  await globalBackgroundQueue.flush()
}
