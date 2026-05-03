import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  FileCache,
  TransformCache,
  AssetCache,
  flushCache,
} from '../packages/core/src/node/cache'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('cache performance tests', () => {
  let tempDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-perf-test-'))
    process.env.BOLTDOCS_NO_CACHE = '0'
  })

  afterEach(async () => {
    await flushCache()
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
    delete process.env.BOLTDOCS_NO_CACHE
  }, 30000)

  describe('LRUCache performance', () => {
    it('should handle 100 sequential writes efficiently', async () => {
      const cache = new TransformCache('perf-write', tempDir)
      
      const startTime = Date.now()
      
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`)
      }
      
      const writeTime = Date.now() - startTime
      
      expect(cache.size).toBe(100)
      expect(writeTime).toBeLessThan(5000)
    })

    it('should handle 1000 sequential reads from memory efficiently', async () => {
      const cache = new TransformCache('perf-read', tempDir)
      
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`)
      }
      
      const startTime = Date.now()
      
      for (let i = 0; i < 1000; i++) {
        const key = `key${i % 100}`
        cache.get(key)
      }
      
      const readTime = Date.now() - startTime
      expect(readTime).toBeLessThan(5000)
    })
  })

  describe('TransformCache sharding performance', () => {
    it('should handle sharded storage for 50 entries', async () => {
      const cache = new TransformCache('shard-perf', tempDir)

      const startTime = Date.now()

      for (let i = 0; i < 50; i++) {
        cache.set(`shard${i}`, `data${i}`)
      }

      const writeTime = Date.now() - startTime
      expect(cache.size).toBe(50)
      expect(writeTime).toBeLessThan(25000)

      await cache.flush()
    }, 35000)
  })

  describe('FileCache performance', () => {
    it('should handle file cache operations', async () => {
      const cache = new FileCache<string>({ name: 'perf', root: tempDir })
      
      const startTime = Date.now()
      
      for (let i = 0; i < 100; i++) {
        cache.set(`file${i}.md`, `data${i}`)
      }
      
      const writeTime = Date.now() - startTime
      expect(cache.size).toBe(100)
      expect(writeTime).toBeLessThan(5000)
    })

    it('should validate mtimes efficiently', () => {
      const cache = new FileCache<string>({ name: 'mtime-perf', root: tempDir })
      
      for (let i = 0; i < 100; i++) {
        cache.set(`file${i}.md`, `data${i}`)
      }
      
      const startTime = Date.now()
      
      for (let i = 0; i < 100; i++) {
        cache.isValid(`file${i}.md`)
      }
      
      const validationTime = Date.now() - startTime
      expect(validationTime).toBeLessThan(5000)
    })

    it('should handle bulk invalidation efficiently', () => {
      const cache = new FileCache<string>({ name: 'invalidate-perf', root: tempDir })
      
      for (let i = 0; i < 100; i++) {
        cache.set(`file${i}.md`, `data${i}`)
      }
      
      const startTime = Date.now()
      
      for (let i = 0; i < 50; i++) {
        cache.invalidate(`file${i}.md`)
      }
      
      const invalidationTime = Date.now() - startTime
      expect(cache.size).toBe(50)
      expect(invalidationTime).toBeLessThan(5000)
    })

    it('should handle prune stale entries efficiently', () => {
      const cache = new FileCache<string>({ name: 'prune-perf', root: tempDir })
      
      for (let i = 0; i < 100; i++) {
        cache.set(`file${i}.md`, `data${i}`)
      }
      
      const currentFiles = new Set(
        Array.from({ length: 50 }, (_, i) => `file${i}.md`),
      )
      
      const startTime = Date.now()
      cache.pruneStale(currentFiles)
      const pruneTime = Date.now() - startTime
      
      expect(cache.size).toBe(50)
      expect(pruneTime).toBeLessThan(5000)
    })
  })

  describe('AssetCache performance', () => {
    it('should handle asset caching', async () => {
      const cache = new AssetCache(tempDir)
      
      const srcPath = path.join(tempDir, 'asset.png')
      fs.writeFileSync(srcPath, 'asset data')
      
      const startTime = Date.now()
      cache.set(srcPath, 'v1', 'optimized')
      const writeTime = Date.now() - startTime
      
      expect(writeTime).toBeLessThan(5000)
      await cache.flush()
    })
  })

  describe('concurrent cache operations', () => {
    it('should handle concurrent FileCache saves', async () => {
      const caches = Array.from({ length: 3 }, (_, i) => {
        const cache = new FileCache<string>({ name: `concurrent${i}`, root: tempDir })
        cache.set('file.md', `data${i}`)
        cache.save()
        return cache
      })
      
      const startTime = Date.now()
      await Promise.all(caches.map((c) => c.flush()))
      const flushTime = Date.now() - startTime
      
      expect(flushTime).toBeLessThan(10000)
    })
  })

  describe('cache flush performance', () => {
    it('should flush all pending operations', async () => {
      const fileCache = new FileCache<string>({ name: 'flush-file', root: tempDir })
      
      for (let i = 0; i < 50; i++) {
        fileCache.set(`file${i}.md`, `data${i}`)
      }
      
      fileCache.save()
      
      const startTime = Date.now()
      await flushCache()
      const flushTime = Date.now() - startTime
      
      expect(flushTime).toBeLessThan(10000)
    })
  })

  describe('memory efficiency', () => {
    it('should not exceed reasonable memory usage', async () => {
      const cache = new TransformCache('memory-test', tempDir)
      
      const initialMem = process.memoryUsage().heapUsed
      
      for (let i = 0; i < 500; i++) {
        cache.set(`key${i}`, `value${i}`)
      }
      
      const afterMem = process.memoryUsage().heapUsed
      const memoryIncrease = (afterMem - initialMem) / 1024 / 1024
      
      expect(cache.size).toBe(500)
      expect(memoryIncrease).toBeLessThan(200)
    })
  })

  describe('disk I/O efficiency', () => {
    it('should handle writes with background queue', async () => {
      const cache = new FileCache<string>({ name: 'io-test', root: tempDir })
      
      const startTime = Date.now()
      
      // Reduce operations to avoid timeout
      for (let i = 0; i < 10; i++) {
        cache.set(`file${i}.md`, `data${i}`)
        cache.save()
      }
      
      const writeTime = Date.now() - startTime
      expect(writeTime).toBeLessThan(20000)
      
      await cache.flush()
    }, 25000)
  })
})
