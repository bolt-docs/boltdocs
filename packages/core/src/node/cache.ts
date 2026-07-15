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
 * Generic file-based cache with per-file granularity and asynchronous persistence.
 */
export class FileCache<T> {
  private entries = new Map<string, { data: T; mtime: number }>()
  private readonly cachePath: string | null = null
  private readonly compress: boolean
  private loaded = false

  constructor(
    options: { name?: string; root?: string; compress?: boolean } = {},
  ) {
    const config = getCacheConfig()
    this.compress =
      options.compress !== undefined ? options.compress : config.compress
    if (options.name) {
      const root = options.root || process.cwd()
      const ext = this.compress ? 'json.gz' : 'json'
      this.cachePath = path.resolve(root, config.dir, `${options.name}.${ext}`)
    }
  }

  /**
   * Loads the cache.
   */
  async load(): Promise<void> {
    if (this.loaded) return
    const config = getCacheConfig()
    if (config.noCache) return
    if (!this.cachePath) return

    try {
      let raw = await readFile(this.cachePath)
      if (this.cachePath.endsWith('.gz')) {
        raw = await gunzipPromise(raw)
      }
      const data = JSON.parse(raw.toString('utf-8'))
      this.entries = new Map(Object.entries(data))
      this.loaded = true
    } catch (e) {
      if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT')
        return
      // Fallback: ignore cache errors
    }
  }

  /**
   * Saves the cache in the background.
   */
  save(): void {
    const config = getCacheConfig()
    if (config.noCache) return
    if (!this.cachePath) return

    const data = Object.fromEntries(this.entries)
    const content = JSON.stringify(data)
    const target = this.cachePath
    const useCompress = this.compress

    globalBackgroundQueue.add(async () => {
      try {
        await mkdir(path.dirname(target), { recursive: true })
        let buffer = Buffer.from(content)
        if (useCompress) {
          buffer = await gzipPromise(buffer)
        }
        const tempPath = `${target}.${crypto.randomBytes(4).toString('hex')}.tmp`
        await writeFile(tempPath, buffer)
        await rename(tempPath, target)
      } catch (e) {
        // Fallback: critical error logging skipped for performance
      }
    })
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
    } catch (e: any) {
      if (e.code === 'ENOENT') return
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
            const decompressedBuffer = await gunzipPromise(compressed)
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
      const decompressedBuffer = await gunzipPromise(compressed)
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

        const compressed = await gzipPromise(Buffer.from(result))
        const tempPath = `${shardPath}.${crypto.randomBytes(4).toString('hex')}.tmp`
        await writeFile(tempPath, compressed)
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
