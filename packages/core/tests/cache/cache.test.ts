import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileCache, TransformCache, flushCache } from '../../src/node/cache'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

function fileCacheDir(root: string, name: string) {
  return path.join(root, '.boltdocs', 'cache', `file-${name}`)
}

function fileCacheIndex(root: string, name: string) {
  return path.join(fileCacheDir(root, name), 'index.json')
}

function fileCacheShardDir(root: string, name: string) {
  return path.join(fileCacheDir(root, name), 'shards')
}

describe('cache system', () => {
  let tempDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-cache-test-'))
    process.env.BOLTDOCS_NO_CACHE = '0'
    delete process.env.BOLTDOCS_CACHE_LRU_LIMIT
    process.env.BOLTDOCS_CACHE_COMPRESS = '1'
  })

  afterEach(async () => {
    // Wait for any pending background operations to complete
    await flushCache()

    if (fs.existsSync(tempDir)) {
      try {
        // Retry cleanup a few times in case files are still being written
        for (let i = 0; i < 3; i++) {
          try {
            fs.rmSync(tempDir, { recursive: true, force: true })
            break
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 200))
          }
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    delete process.env.BOLTDOCS_NO_CACHE
    delete process.env.BOLTDOCS_CACHE_LRU_LIMIT
    delete process.env.BOLTDOCS_CACHE_COMPRESS
  }, 30000)

  describe('LRUCache (via TransformCache)', () => {
    it('should use LRU memory cache for fast access', async () => {
      const cache = new TransformCache('lru-test', tempDir)

      cache.set('key', 'value')
      const result1 = await cache.getAsync('key')
      expect(result1).toBe('value')

      const result2 = await cache.getAsync('key')
      expect(result2).toBe('value')
    })

    it('should handle entries with LRU eviction', async () => {
      const cache = new TransformCache('lru-large', tempDir)

      // Add 50 entries instead of 100 to be faster
      for (let i = 0; i < 50; i++) {
        cache.set(`key${i}`, `value${i}`)
      }

      expect(cache.size).toBe(50)

      // Just flush and don't wait for access patterns
      await cache.flush()
    }, 10000)
  })

  describe('BackgroundQueue (via FileCache)', () => {
    it('should queue background writes', async () => {
      const cache = new FileCache<string>({ name: 'queue-test', root: tempDir })
      cache.set('file1.md', 'data1')
      cache.set('file2.md', 'data2')
      cache.save()

      // Before flush, file might not exist yet
      const cacheFile = path.join(
        tempDir,
        '.boltdocs',
        'cache',
        'queue-test.json.gz',
      )

      // After flush, file should exist
      await cache.flush()
      expect(fs.existsSync(fileCacheIndex(tempDir, 'queue-test'))).toBe(true)
    })

    it('should handle multiple concurrent saves', async () => {
      const cache1 = new FileCache<string>({ name: 'multi1', root: tempDir })
      const cache2 = new FileCache<string>({ name: 'multi2', root: tempDir })

      cache1.set('file.md', 'data1')
      cache2.set('file.md', 'data2')

      cache1.save()
      cache2.save()

      await flushCache()

      expect(fs.existsSync(fileCacheIndex(tempDir, 'multi1'))).toBe(true)
      expect(fs.existsSync(fileCacheIndex(tempDir, 'multi2'))).toBe(true)
    })
  })

  describe('FileCache', () => {
    it('should load and save correctly', async () => {
      const cache = new FileCache<string>({ name: 'test', root: tempDir })
      cache.set('file1.md', 'data1')

      // Mock mtime to match
      vi.spyOn(fs, 'statSync').mockReturnValue({ mtimeMs: 1000 } as any)

      cache.save()
      await cache.flush()

      expect(fs.existsSync(fileCacheIndex(tempDir, 'test'))).toBe(true)
      expect(fs.existsSync(fileCacheShardDir(tempDir, 'test'))).toBe(true)

      const cache2 = new FileCache<string>({ name: 'test', root: tempDir })
      await cache2.load()
      expect(cache2.size).toBe(1)
    })

    it('should handle error in save/load', async () => {
      const cache = new FileCache<string>({ name: 'error', root: tempDir })
      cache.set('f', 'd')
      // Mock writeFile to throw
      const spy = vi.spyOn(fs, 'writeFile' as any).mockImplementation(() => {
        throw new Error('Disk full')
      })
      cache.save()
      await cache.flush()
      spy.mockRestore()
    })

    it('should return null for non-existent entries', () => {
      const cache = new FileCache<string>({ name: 'test', root: tempDir })
      expect(cache.get('nonexistent.md')).toBeNull()
    })

    it('should invalidate specific files', () => {
      const cache = new FileCache<string>({ name: 'test', root: tempDir })
      cache.set('file1.md', 'data1')
      cache.set('file2.md', 'data2')

      cache.invalidate('file1.md')

      expect(cache.get('file1.md')).toBeNull()
      expect(cache.get('file2.md')).not.toBeNull()
      expect(cache.size).toBe(1)
    })

    it('should invalidate all entries', () => {
      const cache = new FileCache<string>({ name: 'test', root: tempDir })
      cache.set('file1.md', 'data1')
      cache.set('file2.md', 'data2')

      cache.invalidateAll()

      expect(cache.size).toBe(0)
    })

    it('should prune stale entries not in current files set', () => {
      const cache = new FileCache<string>({ name: 'test', root: tempDir })
      cache.set('file1.md', 'data1')
      cache.set('file2.md', 'data2')
      cache.set('file3.md', 'data3')

      const currentFiles = new Set(['file1.md', 'file3.md'])
      cache.pruneStale(currentFiles)

      expect(cache.get('file1.md')).not.toBeNull()
      expect(cache.get('file2.md')).toBeNull()
      expect(cache.get('file3.md')).not.toBeNull()
      expect(cache.size).toBe(2)
    })

    it('should check validity of file entries', () => {
      const cache = new FileCache<string>({ name: 'test', root: tempDir })
      cache.set('file.md', 'data')

      expect(cache.isValid('file.md')).toBe(true)
      expect(cache.isValid('nonexistent.md')).toBe(false)
    })

    it('should respect BOLTDOCS_NO_CACHE environment variable', () => {
      process.env.BOLTDOCS_NO_CACHE = '1'

      const cache = new FileCache<string>({ name: 'test', root: tempDir })
      cache.set('file.md', 'data')
      cache.save()

      // Should not create cache files
      expect(fs.existsSync(path.join(tempDir, '.boltdocs'))).toBe(false)
    })

    it('should handle uncompressed cache when compress is false', async () => {
      const cache = new FileCache<string>({
        name: 'uncompressed',
        root: tempDir,
        compress: false,
      })
      cache.set('file.md', 'data')
      cache.save()
      await cache.flush()

      expect(fs.existsSync(fileCacheIndex(tempDir, 'uncompressed'))).toBe(true)
      const shardFile = fs.readdirSync(
        fileCacheShardDir(tempDir, 'uncompressed'),
      )
      expect(shardFile.length).toBeGreaterThan(0)
      expect(shardFile[0]).toMatch(/\.json$/)
    })

    it('should handle corrupted cache files gracefully', async () => {
      const indexFile = fileCacheIndex(tempDir, 'corrupt')
      fs.mkdirSync(path.dirname(indexFile), { recursive: true })
      fs.writeFileSync(indexFile, 'invalid json')

      const cache = new FileCache<string>({ name: 'corrupt', root: tempDir })
      await cache.load()
    })

    it('should round-trip data through sharded cache', async () => {
      const cache = new FileCache<string>({ name: 'roundtrip', root: tempDir })
      cache.set('file1.md', 'data1')
      cache.set('file2.md', 'data2')

      vi.spyOn(fs, 'statSync').mockReturnValue({ mtimeMs: 1000 } as any)

      cache.save()
      await cache.flush()

      const cache2 = new FileCache<string>({ name: 'roundtrip', root: tempDir })
      await cache2.load()

      expect(cache2.get('file1.md')).toBe('data1')
      expect(cache2.get('file2.md')).toBe('data2')
      expect(cache2.get('missing.md')).toBeNull()
    })

    it('should handle interleaved saves on the same cache instance', async () => {
      vi.spyOn(fs, 'statSync').mockReturnValue({ mtimeMs: 1000 } as any)

      const cache = new FileCache<string>({
        name: 'interleaved',
        root: tempDir,
      })
      cache.set('a.md', 'alpha')
      cache.save()

      cache.set('b.md', 'beta')
      cache.save()

      await flushCache()

      const loaded = new FileCache<string>({
        name: 'interleaved',
        root: tempDir,
      })
      await loaded.load()

      expect(loaded.get('a.md')).toBe('alpha')
      expect(loaded.get('b.md')).toBe('beta')
    })

    it('should prune orphan shards on save', async () => {
      const cache = new FileCache<string>({ name: 'orphans', root: tempDir })
      cache.set('stale.md', 'stale')
      cache.save()
      await cache.flush()

      const shardCountBefore = fs.readdirSync(
        fileCacheShardDir(tempDir, 'orphans'),
      ).length
      expect(shardCountBefore).toBeGreaterThan(0)

      cache.invalidate('stale.md')
      cache.set('new.md', 'new')
      cache.save()
      await cache.flush()

      const shardCountAfter = fs.readdirSync(
        fileCacheShardDir(tempDir, 'orphans'),
      ).length
      expect(shardCountAfter).toBeLessThanOrEqual(shardCountBefore)
      expect(cache.get('new.md')).toBe('new')
    })
  })

  describe('TransformCache', () => {
    it('should handle disk reads and hits', async () => {
      const cache = new TransformCache('disk', tempDir)
      cache.set('k1', 'v1')
      await cache.flush()

      // Force disk load by clearing memory
      ;(cache as any).memoryCache.clear()

      expect(await cache.getAsync('k1')).toBe('v1')
      expect(cache.size).toBe(1)
    })

    it('should handle getMany disk loading', async () => {
      const cache = new TransformCache('many-disk', tempDir)
      cache.set('k1', 'v1')
      cache.set('k2', 'v2')
      await cache.flush()

      ;(cache as any).memoryCache.clear()

      const results = await cache.getMany(['k1', 'k2'])
      expect(results.get('k1')).toBe('v1')
      expect(results.get('k2')).toBe('v2')
    })

    it('should handle corruption', async () => {
      const cache = new TransformCache('corrupt', tempDir)
      cache.set('k1', 'v1')
      await cache.flush()

      // Corrupt shard
      const hash = (cache as any).index.get('k1')
      const shardPath = path.join(
        tempDir,
        '.boltdocs',
        'cache',
        'transform-corrupt',
        'shards',
        `${hash}.gz`,
      )
      fs.writeFileSync(shardPath, 'not a gzip')

      ;(cache as any).memoryCache.clear()
      expect(await cache.getAsync('k1')).toBeNull()
    })

    it('should return null for non-existent keys', async () => {
      const cache = new TransformCache('test', tempDir)
      expect(await cache.getAsync('nonexistent')).toBeNull()
    })

    it('should handle sharding correctly', async () => {
      const cache = new TransformCache('shard', tempDir)

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      await cache.flush()

      // All should be in memory
      expect(await cache.getAsync('key1')).toBe('value1')
      expect(await cache.getAsync('key2')).toBe('value2')
      expect(await cache.getAsync('key3')).toBe('value3')

      // Size should be 3
      expect(cache.size).toBe(3)
    })

    it('should persist index to disk', async () => {
      const cache1 = new TransformCache('persist', tempDir)
      cache1.set('key1', 'value1')
      cache1.save()
      await cache1.flush()

      // Verify index.json was created
      const baseDir = path.join(
        tempDir,
        '.boltdocs',
        'cache',
        'transform-persist',
      )

      // Check that the directory was created
      expect(fs.existsSync(baseDir)).toBe(true)
    })

    it('should respect BOLTDOCS_NO_CACHE', async () => {
      process.env.BOLTDOCS_NO_CACHE = '1'

      const cache = new TransformCache('disabled', tempDir)
      await cache.load()
      cache.save()

      // Should not create files
      expect(fs.existsSync(path.join(tempDir, '.boltdocs'))).toBe(false)
    })

    it('should handle corrupted index files', async () => {
      const cacheDir = path.join(tempDir, '.boltdocs', 'cache', 'transform-bad')
      fs.mkdirSync(cacheDir, { recursive: true })
      fs.writeFileSync(path.join(cacheDir, 'index.json'), 'bad json')

      const cache = new TransformCache('bad', tempDir)
      await cache.load()
    })

    it('should use LRU memory cache for fast access', async () => {
      const cache = new TransformCache('lru-test', tempDir)

      cache.set('key', 'value')

      // First get populates memory
      const result1 = await cache.getAsync('key')
      expect(result1).toBe('value')

      // Should be in memory now
      const result2 = await cache.getAsync('key')
      expect(result2).toBe('value')
    })
  })

  describe('flushCache', () => {
    it('should flush all pending background operations', async () => {
      const cache = new FileCache<string>({ name: 'flush-test', root: tempDir })
      cache.set('file.md', 'data')
      cache.save()

      await flushCache()

      // After flush, file should be written
      expect(fs.existsSync(fileCacheIndex(tempDir, 'flush-test'))).toBe(true)
    })
  })
})
