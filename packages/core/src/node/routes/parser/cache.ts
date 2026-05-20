import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { ParsedDocFile } from '../types'
import { getCacheConfig } from '../../utils'
import { globalBackgroundQueue } from '../../cache'

const memoryCache = new Map<string, { data: ParsedDocFile; mtime: number }>()

const getParserCacheDir = () => {
  const config = getCacheConfig()
  return path.resolve(process.cwd(), config.dir, 'cache/parser')
}

const PARSER_VERSION = 'v2.3' // Increment this to invalidate all parser caches

/**
 * Fast sharded cache for parser results.
 * Optimized with asynchronous I/O and background persistence.
 */
export class ParserCache {
  /**
   * Retrieves a cached parser result.
   * Optimized to minimize I/O by checking memory first and using async stat.
   */
  static async get(file: string): Promise<ParsedDocFile | null> {
    const config = getCacheConfig()
    if (config.noCache) return null

    try {
      // 1. Memory Tier (Ultra-fast check)
      const memEntry = memoryCache.get(file)
      if (memEntry) {
        return memEntry.data
      }

      // 2. Disk Tier
      const stats = await fs.promises.stat(file)
      const cacheDir = getParserCacheDir()
      const id = crypto.createHash('md5').update(file).digest('hex')
      const shardPath = path.join(cacheDir, `${id}.json`)

      try {
        const raw = await fs.promises.readFile(shardPath, 'utf-8')
        const cached = JSON.parse(raw)

        // Validation: Check mtime AND parser version
        if (cached._mtime !== stats.mtimeMs || cached._v !== PARSER_VERSION)
          return null

        // Update memory tier
        memoryCache.set(file, { data: cached.data, mtime: cached._mtime })

        return cached.data
      } catch {
        return null // Shard doesn't exist or is corrupt
      }
    } catch {
      return null
    }
  }

  /**
   * Stores a parser result.
   * Updates memory immediately and queues disk write in background.
   */
  static async set(file: string, data: ParsedDocFile): Promise<void> {
    const config = getCacheConfig()
    if (config.noCache) return

    try {
      const stats = await fs.promises.stat(file)

      // Update memory tier immediately for instant re-read
      memoryCache.set(file, { data, mtime: stats.mtimeMs })

      const cacheDir = getParserCacheDir()
      const id = crypto.createHash('md5').update(file).digest('hex')
      const shardPath = path.join(cacheDir, `${id}.json`)

      const payload = {
        _v: PARSER_VERSION,
        _mtime: stats.mtimeMs,
        data,
      }

      // Non-blocking disk write
      globalBackgroundQueue.add(async () => {
        try {
          await fs.promises.mkdir(cacheDir, { recursive: true })
          await fs.promises.writeFile(shardPath, JSON.stringify(payload))
        } catch {
          // Ignore background write errors
        }
      })
    } catch {
      // Fallback: Skip caching if file cannot be stat'd
    }
  }

  static invalidate(file: string): void {
    memoryCache.delete(file)
  }

  static clear(): void {
    memoryCache.clear()
    const cacheDir = getParserCacheDir()
    if (fs.existsSync(cacheDir)) {
      try {
        fs.rmSync(cacheDir, { recursive: true, force: true })
      } catch {
        // Ignore removal errors
      }
    }
  }
}
