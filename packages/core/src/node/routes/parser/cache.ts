import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { ParsedDocFile } from '../types'
import { getCacheConfig } from '../../utils'
import { globalBackgroundQueue } from '../../cache'

const PARSER_VERSION = 'v2.5'

type MemoryEntry = { data: ParsedDocFile; mtime: number }

/**
 * Parsed-document cache scoped to one Boltdocs project.
 *
 * The old implementation kept one process-wide Map. That was fast, but a
 * second project in the same process could observe the first project's
 * parsed documents. Instances are intentionally cheap and are owned by a
 * RouteCacheContext.
 */
export class ParserCache {
  private readonly memoryCache = new Map<string, MemoryEntry>()
  private readonly cacheDir: string

  constructor(root: string = process.cwd(), namespace = 'legacy') {
    const config = getCacheConfig()
    this.cacheDir = path.resolve(root, config.dir, `parser-${namespace}`)
  }

  async get(file: string): Promise<ParsedDocFile | null> {
    const config = getCacheConfig()
    if (config.noCache) return null

    try {
      const stats = await fs.promises.stat(file)
      const memEntry = this.memoryCache.get(file)
      if (memEntry && memEntry.mtime === stats.mtimeMs) {
        return memEntry.data
      }

      const id = crypto.createHash('md5').update(file).digest('hex')
      const shardPath = path.join(this.cacheDir, `${id}.json`)

      try {
        const raw = await fs.promises.readFile(shardPath, 'utf-8')
        const cached = JSON.parse(raw) as {
          _mtime: number
          _v: string
          data: ParsedDocFile
        }

        if (cached._mtime !== stats.mtimeMs || cached._v !== PARSER_VERSION) {
          return null
        }

        this.memoryCache.set(file, {
          data: cached.data,
          mtime: cached._mtime,
        })
        return cached.data
      } catch {
        return null
      }
    } catch {
      return null
    }
  }

  async set(file: string, data: ParsedDocFile): Promise<void> {
    const config = getCacheConfig()
    if (config.noCache) return

    try {
      const stats = await fs.promises.stat(file)
      this.memoryCache.set(file, { data, mtime: stats.mtimeMs })

      const id = crypto.createHash('md5').update(file).digest('hex')
      const shardPath = path.join(this.cacheDir, `${id}.json`)
      const payload = JSON.stringify({
        _v: PARSER_VERSION,
        _mtime: stats.mtimeMs,
        data,
      })

      globalBackgroundQueue.add(async () => {
        try {
          await fs.promises.mkdir(this.cacheDir, { recursive: true })
          await fs.promises.writeFile(shardPath, payload)
        } catch {
          // Cache persistence is best effort.
        }
      })
    } catch {
      // The source may disappear during HMR; the in-memory write is skipped.
    }
  }

  invalidate(file: string): void {
    this.memoryCache.delete(file)
  }

  /**
   * Clear only the process-local entries.
   *
   * Disk shards are versioned and validated by `get()` using the source mtime,
   * so deleting the whole directory on every route invalidation only creates
   * unnecessary I/O and forces unchanged files to be parsed again. Stale
   * shards are harmless and are naturally replaced when their files change.
   */
  clear(): void {
    this.memoryCache.clear()
  }

  get size(): number {
    return this.memoryCache.size
  }
}

/**
 * Legacy facade retained for direct consumers of ParserCache.get/set.
 * New route generation always supplies an instance owned by its project
 * context, while existing integrations continue to use process.cwd().
 */
const legacyParserCache = new ParserCache()

export namespace ParserCache {
  export const get = (file: string) => legacyParserCache.get(file)
  export const set = (file: string, data: ParsedDocFile) =>
    legacyParserCache.set(file, data)
  export const invalidate = (file: string) => legacyParserCache.invalidate(file)
  export const clear = () => legacyParserCache.clear()
}
