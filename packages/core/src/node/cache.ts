import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import zlib from 'zlib'
import { promisify } from 'util'
import { getFileMtime, getCacheConfig } from './utils'

const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const mkdir = promisify(fs.mkdir)
const rename = promisify(fs.rename)

/**
 * Assets and Shards directory names.
 */
const ASSETS_DIR = 'assets'
const SHARDS_DIR = 'shards'

/**
 * Simple LRU cache implementation to prevent memory leaks.
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>()
  constructor(private limit: number) { }

  get(key: K): V | undefined {
    const val = this.cache.get(key)
    if (val !== undefined) {
      this.cache.delete(key)
      this.cache.set(key, val)
    }
    return val
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.limit) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, value)
  }

  get size() {
    return this.cache.size
  }
  clear() {
    this.cache.clear()
  }
}

/**
 * Simple background task queue to prevent blocking the main thread during IO.
 */
class BackgroundQueue {
  private queue: Promise<any> = Promise.resolve()
  private pendingCount = 0

  add(task: () => Promise<any>) {
    this.pendingCount++
    this.queue = this.queue
      .then(async () => {
        try {
          await task()
        } catch (e) {
          // Task failed, but don't block subsequent tasks
        }
      })
      .finally(() => {
        this.pendingCount--
      })
  }

  async flush() {
    await this.queue
  }

  get pending() {
    return this.pendingCount
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
    const config = getCacheConfig()
    if (config.noCache) return
    if (!this.cachePath) return

    try {
      if (!fs.existsSync(this.cachePath)) return

      let raw = await readFile(this.cachePath)
      if (this.cachePath.endsWith('.gz')) {
        raw = await promisify(zlib.gunzip)(raw)
      }
      const data = JSON.parse(raw.toString('utf-8'))
      this.entries = new Map(Object.entries(data))
    } catch (e) {
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
          buffer = zlib.gzipSync(buffer)
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

  constructor(name: string, root: string = process.cwd()) {
    const config = getCacheConfig()
    this.baseDir = path.resolve(root, config.dir, `transform-${name}`)
    this.shardsDir = path.resolve(this.baseDir, SHARDS_DIR)
    this.indexPath = path.resolve(this.baseDir, 'index.json')
    this.memoryCache = new LRUCache<string, string>(config.lruLimit)
  }

  /**
   * Loads the index into memory.
   */
  async load(): Promise<void> {
    const config = getCacheConfig()
    if (config.noCache) return

    try {
      if (!fs.existsSync(this.indexPath)) return
      const data = await readFile(this.indexPath, 'utf-8')
      this.index = new Map(Object.entries(JSON.parse(data)))
    } catch (e) {
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
            const decompressed = zlib.gunzipSync(compressed).toString('utf-8')
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
   * Retrieves a cached transformation. Fast lookup via index, lazy loading from disk.
   */
  get(key: string): string | null {
    // 1. Check memory first (LRU)
    const mem = this.memoryCache.get(key)
    if (mem) return mem

    // 2. Check index
    const hash = this.index.get(key)
    if (!hash) return null

    // 3. Load from shard (synchronous read for Vite's transform hook compatibility)
    const shardPath = path.resolve(this.shardsDir, `${hash}.gz`)
    if (!fs.existsSync(shardPath)) return null

    try {
      const compressed = fs.readFileSync(shardPath)
      const decompressed = zlib.gunzipSync(compressed).toString('utf-8')
      this.memoryCache.set(key, decompressed)
      return decompressed
    } catch (e) {
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
        if (fs.existsSync(shardPath)) return // Already exists
        await mkdir(this.shardsDir, { recursive: true })

        const compressed = zlib.gzipSync(Buffer.from(result))
        const tempPath = `${shardPath}.${crypto.randomBytes(4).toString('hex')}.tmp`
        await writeFile(tempPath, compressed)
        await rename(tempPath, shardPath)
      } catch (e) {
        // Ignore shard write errors
      }
    })
  }

  get size() {
    return this.index.size
  }

  async flush() {
    await globalBackgroundQueue.flush()
  }
}

/**
 * Specialized cache for processed assets (e.g., optimized images).
 */
export class AssetCache {
  private readonly assetsDir: string

  constructor(root: string = process.cwd()) {
    const config = getCacheConfig()
    this.assetsDir = path.resolve(root, config.dir, ASSETS_DIR)
  }

  private getFileHash(filePath: string): string {
    return crypto
      .createHash('md5')
      .update(fs.readFileSync(filePath))
      .digest('hex')
  }

  get(sourcePath: string, cacheKey: string): string | null {
    if (!fs.existsSync(sourcePath)) return null
    const sourceHash = this.getFileHash(sourcePath)
    const cachedPath = this.getCachedPath(
      sourcePath,
      `${cacheKey}-${sourceHash}`,
    )
    return fs.existsSync(cachedPath) ? cachedPath : null
  }

  set(sourcePath: string, cacheKey: string, content: Buffer | string): void {
    const sourceHash = this.getFileHash(sourcePath)
    const cachedPath = this.getCachedPath(
      sourcePath,
      `${cacheKey}-${sourceHash}`,
    )

    globalBackgroundQueue.add(async () => {
      try {
        await mkdir(this.assetsDir, { recursive: true })
        const tempPath = `${cachedPath}.${crypto.randomBytes(4).toString('hex')}.tmp`
        await writeFile(tempPath, content)
        await rename(tempPath, cachedPath)
      } catch (e) {
        // Ignore asset write errors
      }
    })
  }

  private getCachedPath(sourcePath: string, cacheKey: string): string {
    const ext = path.extname(sourcePath)
    const name = path.basename(sourcePath, ext)
    const safeKey = cacheKey.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    return path.join(this.assetsDir, `${name}.${safeKey}${ext}`)
  }

  clear(): void {
    if (fs.existsSync(this.assetsDir)) {
      fs.rmSync(this.assetsDir, { recursive: true, force: true })
    }
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
