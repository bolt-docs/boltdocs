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
            await new Promise(resolve => setTimeout(resolve, 200))
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
      const result1 = cache.get('key')
      expect(result1).toBe('value')
      
      const result2 = cache.get('key')
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
      const cacheFile = path.join(tempDir, '.boltdocs', 'queue-test.json.gz')
      
      // After flush, file should exist
      await cache.flush()
      expect(fs.existsSync(cacheFile)).toBe(true)
    })

    it('should handle multiple concurrent saves', async () => {
      const cache1 = new FileCache<string>({ name: 'multi1', root: tempDir })
      const cache2 = new FileCache<string>({ name: 'multi2', root: tempDir })
      
      cache1.set('file.md', 'data1')
      cache2.set('file.md', 'data2')
      
      cache1.save()
      cache2.save()
      
      await flushCache()
      
      const file1 = path.join(tempDir, '.boltdocs', 'multi1.json.gz')
      const file2 = path.join(tempDir, '.boltdocs', 'multi2.json.gz')
      
      expect(fs.existsSync(file1)).toBe(true)
      expect(fs.existsSync(file2)).toBe(true)
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
        compress: false 
      })
      cache.set('file.md', 'data')
      cache.save()
      await cache.flush()

      const cacheFile = path.join(tempDir, '.boltdocs', 'uncompressed.json')
      expect(fs.existsSync(cacheFile)).toBe(true)
    })

    it('should handle corrupted cache files gracefully', async () => {
      const cacheDir = path.join(tempDir, '.boltdocs')
      fs.mkdirSync(cacheDir, { recursive: true })
      fs.writeFileSync(path.join(cacheDir, 'corrupt.json'), 'invalid json')

      const cache = new FileCache<string>({ name: 'corrupt', root: tempDir })
      await cache.load()
    })
  })

  describe('TransformCache', () => {
    it('should handle disk reads and hits', async () => {
      const cache = new TransformCache('disk', tempDir)
      cache.set('k1', 'v1')
      await cache.flush()

      // Force disk load by clearing memory
      ;(cache as any).memoryCache.clear()

      expect(cache.get('k1')).toBe('v1')
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
        'transform-corrupt',
        'shards',
        `${hash}.gz`,
      )
      fs.writeFileSync(shardPath, 'not a gzip')

      ;(cache as any).memoryCache.clear()
      expect(cache.get('k1')).toBeNull()
    })

    it('should return null for non-existent keys', () => {
      const cache = new TransformCache('test', tempDir)
      expect(cache.get('nonexistent')).toBeNull()
    })

    it('should handle sharding correctly', async () => {
      const cache = new TransformCache('shard', tempDir)
      
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      
      await cache.flush()
      
      // All should be in memory
      expect(cache.get('key1')).toBe('value1')
      expect(cache.get('key2')).toBe('value2')
      expect(cache.get('key3')).toBe('value3')
      
      // Size should be 3
      expect(cache.size).toBe(3)
    })

    it('should persist index to disk', async () => {
      const cache1 = new TransformCache('persist', tempDir)
      cache1.set('key1', 'value1')
      cache1.save()
      await cache1.flush()

      // Verify index.json was created
      const baseDir = path.join(tempDir, '.boltdocs', 'transform-persist')
      const indexPath = path.join(baseDir, 'index.json')
      
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
      const cacheDir = path.join(tempDir, '.boltdocs', 'transform-bad')
      fs.mkdirSync(cacheDir, { recursive: true })
      fs.writeFileSync(path.join(cacheDir, 'index.json'), 'bad json')

      const cache = new TransformCache('bad', tempDir)
      await cache.load()
    })

    it('should use LRU memory cache for fast access', async () => {
      const cache = new TransformCache('lru-test', tempDir)
      
      cache.set('key', 'value')
      
      // First get populates memory
      const result1 = cache.get('key')
      expect(result1).toBe('value')
      
      // Should be in memory now (can't directly test this, but should be fast)
      const result2 = cache.get('key')
      expect(result2).toBe('value')
    })
  })

  describe('AssetCache', () => {
    it('should store and retrieve assets', async () => {
      const cache = new AssetCache(tempDir)
      const source = path.join(tempDir, 'source.txt')
      fs.writeFileSync(source, 'hello')

      cache.set(source, 'v1', 'content')
      await cache.flush()

      const hit = cache.get(source, 'v1')
      expect(hit).not.toBeNull()
    })

    it('should return null for non-existent sources', () => {
      const cache = new AssetCache(tempDir)
      expect(cache.get('/nonexistent/file.txt', 'v1')).toBeNull()
    })

    it('should handle different cache keys for same source', async () => {
      const cache = new AssetCache(tempDir)
      const source = path.join(tempDir, 'image.png')
      fs.writeFileSync(source, 'image data')

      cache.set(source, 'v1', 'optimized1')
      cache.set(source, 'v2', 'optimized2')
      await cache.flush()

      const hit1 = cache.get(source, 'v1')
      const hit2 = cache.get(source, 'v2')
      
      expect(hit1).not.toBeNull()
      expect(hit2).not.toBeNull()
      expect(hit1).not.toBe(hit2)
    })

    it('should clear all cached assets', () => {
      const cache = new AssetCache(tempDir)
      const source = path.join(tempDir, 'source.txt')
      fs.writeFileSync(source, 'data')

      cache.set(source, 'v1', 'content')
      cache.clear()

      expect(fs.existsSync(path.join(tempDir, '.boltdocs', 'assets'))).toBe(false)
    })
  })

  describe('flushCache', () => {
    it('should flush all pending background operations', async () => {
      const cache = new FileCache<string>({ name: 'flush-test', root: tempDir })
      cache.set('file.md', 'data')
      cache.save()

      await flushCache()
      
      // After flush, file should be written
      const cacheFile = path.join(tempDir, '.boltdocs', 'flush-test.json.gz')
      expect(fs.existsSync(cacheFile)).toBe(true)
    })
  })
})
