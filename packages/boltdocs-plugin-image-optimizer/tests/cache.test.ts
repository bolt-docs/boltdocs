import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  deepMerge,
  readAllFiles,
  areFilesMatching,
  logOptimizationStats,
} from '../src/utils'
import { AssetCache } from '../src/cache'

describe('deepMerge', () => {
  it('merges nested objects recursively', () => {
    const result = deepMerge({ a: { b: 1, c: 2 }, d: 3 }, { a: { b: 9 }, e: 4 })
    expect(result).toEqual({ a: { b: 9, c: 2 }, d: 3, e: 4 })
  })

  it('ignores non-object sources', () => {
    expect(deepMerge(null, 'x', 42, { a: 1 })).toEqual({ a: 1 })
  })

  it('later sources win for scalars', () => {
    const result = deepMerge({ a: 1 }, { a: 2 })
    expect(result).toEqual({ a: 2 })
  })
})

describe('readAllFiles', () => {
  let root: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'img-root-'))
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('recursively lists files', () => {
    fs.mkdirSync(path.join(root, 'sub'))
    fs.writeFileSync(path.join(root, 'a.png'), 'x')
    fs.writeFileSync(path.join(root, 'sub', 'b.jpg'), 'y')
    const files = readAllFiles(root)
    expect(files).toHaveLength(2)
    expect(files.some((f) => f.endsWith('a.png'))).toBe(true)
    expect(files.some((f) => f.endsWith('b.jpg'))).toBe(true)
  })

  it('returns an empty list for a missing root', () => {
    expect(readAllFiles(path.join(root, 'nope'))).toEqual([])
  })
})

describe('areFilesMatching', () => {
  it('matches by exact filename (string)', () => {
    expect(areFilesMatching('logo.png', '/path/logo.png', 'logo.png')).toBe(
      true,
    )
    expect(areFilesMatching('other.png', '/path/logo.png', 'logo.png')).toBe(
      false,
    )
  })

  it('matches by regex against the path', () => {
    expect(areFilesMatching('a.png', '/assets/logo.png', /\.png$/)).toBe(true)
    expect(areFilesMatching('a.webp', '/assets/logo.webp', /\.png$/)).toBe(
      false,
    )
  })

  it('matches against an allow-list array', () => {
    expect(areFilesMatching('a.png', '/p/a.png', ['a.png', 'b.png'])).toBe(true)
    expect(areFilesMatching('c.png', '/p/c.png', ['a.png'])).toBe(false)
  })
})

describe('logOptimizationStats', () => {
  it('does not throw for an empty map', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    logOptimizationStats(new Map())
    vi.restoreAllMocks()
  })
})

describe('AssetCache', () => {
  let root: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'img-cache-'))
    vi.stubEnv('BOLTDOCS_CACHE_DIR', '.boltdocs/cache')
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('computes a file hash stable per stat', async () => {
    const src = path.join(root, 'logo.png')
    fs.writeFileSync(src, 'data')
    const cache = new AssetCache(root)
    const h1 = await cache.getFileHash(src)
    const h2 = await cache.getFileHash(src)
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[a-f0-9]{32}$/)
  })

  it('writes a cached asset and reads it back', async () => {
    const src = path.join(root, 'logo.png')
    fs.writeFileSync(src, 'source')
    const cache = new AssetCache(root)
    const sourceHash = await cache.getFileHash(src)
    cache.set(src, 'opts-hash', Buffer.from([1, 2, 3]), sourceHash)
    await cache.flush()
    const cachedPath = await cache.get(src, 'opts-hash')
    expect(cachedPath).toBeTruthy()
  })

  it('returns null when a cache entry does not exist', async () => {
    const src = path.join(root, 'missing.png')
    const cache = new AssetCache(root)
    expect(await cache.get(src, 'nope')).toBeNull()
  })
})
