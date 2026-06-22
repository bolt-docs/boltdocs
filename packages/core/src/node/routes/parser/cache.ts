import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { ParsedDocFile } from '../types'
import { getCacheConfig } from '../../utils'
import { globalBackgroundQueue } from '../../cache'

const memoryCache = new Map<string, { data: ParsedDocFile; mtime: number }>()

const getParserCacheDir = () => {
  const config = getCacheConfig()
  return path.resolve(process.cwd(), config.dir, 'parser')
}

const PARSER_VERSION = 'v2.5'

export class ParserCache {
  static async get(file: string): Promise<ParsedDocFile | null> {
    const config = getCacheConfig()
    if (config.noCache) return null

    try {
      const stats = await fs.promises.stat(file)

      const memEntry = memoryCache.get(file)
      if (memEntry && memEntry.mtime === stats.mtimeMs) {
        return memEntry.data
      }

      const cacheDir = getParserCacheDir()
      const id = crypto.createHash('md5').update(file).digest('hex')
      const shardPath = path.join(cacheDir, `${id}.json`)

      try {
        const raw = await fs.promises.readFile(shardPath, 'utf-8')
        const cached = JSON.parse(raw)

        if (cached._mtime !== stats.mtimeMs || cached._v !== PARSER_VERSION)
          return null

        memoryCache.set(file, { data: cached.data, mtime: cached._mtime })

        return cached.data
      } catch {
        return null // Shard doesn't exist or is corrupt
      }
    } catch {
      return null
    }
  }

  static async set(file: string, data: ParsedDocFile): Promise<void> {
    const config = getCacheConfig()
    if (config.noCache) return

    try {
      const stats = await fs.promises.stat(file)

      memoryCache.set(file, { data, mtime: stats.mtimeMs })

      const cacheDir = getParserCacheDir()
      const id = crypto.createHash('md5').update(file).digest('hex')
      const shardPath = path.join(cacheDir, `${id}.json`)

      const payload = {
        _v: PARSER_VERSION,
        _mtime: stats.mtimeMs,
        data,
      }

      globalBackgroundQueue.add(async () => {
        try {
          await fs.promises.mkdir(cacheDir, { recursive: true })
          await fs.promises.writeFile(shardPath, JSON.stringify(payload))
        } catch {}
      })
    } catch {}
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
      } catch {}
    }
  }
}
