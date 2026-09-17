import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import crypto from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  getSsgSourceContentHash,
  hashSourceFileContentSync,
  isSsgPageCacheValid,
} from '../src/node/cache-validation'

function createTempDir(prefix: string): string {
  const dir = join(tmpdir(), `boltdocs-content-hash-${prefix}-${Date.now()}`)
  fs.ensureDirSync(dir)
  return dir
}

describe('getSsgSourceContentHash (content-based)', () => {
  let root: string

  beforeEach(() => {
    root = createTempDir('root')
  })

  afterEach(() => {
    try {
      fs.removeSync(root)
    } catch {}
  })

  it('hashes file content, not metadata', () => {
    const source = join(root, 'docs', 'intro.mdx')
    fs.ensureDirSync(join(root, 'docs'))
    fs.writeFileSync(source, '# Intro\n')

    const hash1 = getSsgSourceContentHash(source, 'fallback')
    expect(hash1).toMatch(/^[0-9a-f]{40}$/)

    // Same content, rewritten (new mtime) → same hash.
    const stat = fs.statSync(source)
    fs.writeFileSync(source, '# Intro\n')
    fs.utimesSync(source, stat.atime, new Date(stat.mtimeMs + 60_000))
    expect(getSsgSourceContentHash(source, 'fallback')).toBe(hash1)
  })

  it('changes when content changes but mtime stays equal', () => {
    const source = join(root, 'docs', 'intro.mdx')
    fs.ensureDirSync(join(root, 'docs'))
    fs.writeFileSync(source, '# Intro\n')
    const hash1 = getSsgSourceContentHash(source, 'fallback')

    const stat = fs.statSync(source)
    fs.writeFileSync(source, '# Intro v2\n')
    // Force mtime back so ONLY the content differs.
    fs.utimesSync(source, stat.atime, new Date(stat.mtimeMs))
    const hash2 = getSsgSourceContentHash(source, 'fallback')

    expect(hash2).not.toBe(hash1)
  })

  it('differs per content-hash version and respects the fallback', () => {
    const source = join(root, 'docs', 'intro.mdx')
    fs.ensureDirSync(join(root, 'docs'))
    fs.writeFileSync(source, '# Intro\n')

    // Version is part of the hash input: bumping it invalidates all entries.
    const hash = hashSourceFileContentSync(source, 'legacy')
    const hasher = crypto.createHash('sha1')
    const raw = fs.readFileSync(source)
    hasher.update(
      new Uint8Array(
        raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
      ),
    )
    expect(hash).not.toBe(hasher.digest('hex'))

    expect(getSsgSourceContentHash(undefined, 'fallback')).toBe('fallback')
    expect(hashSourceFileContentSync(join(root, 'missing.mdx'), 'legacy')).toBe(
      'legacy',
    )
  })

  it('a mtime-only change no longer invalidates the page cache', () => {
    const pages = join(root, 'ssg-pages')
    fs.ensureDirSync(pages)
    const source = join(root, 'docs', 'intro.mdx')
    fs.ensureDirSync(join(root, 'docs'))
    fs.writeFileSync(source, '# Intro\n')
    const routePath = '/docs/intro'
    const pathHash = crypto.createHash('md5').update(routePath).digest('hex')
    fs.writeFileSync(join(pages, `${pathHash}.html`), '<html />')

    const item = {
      contentHash: getSsgSourceContentHash(source, 'global'),
      assetHash: 'assets',
    }

    // Same content, different mtime (git checkout scenario): still valid.
    const stat = fs.statSync(source)
    fs.writeFileSync(source, '# Intro\n')
    fs.utimesSync(source, stat.atime, new Date(stat.mtimeMs + 60_000))
    const hashAfterCheckout = getSsgSourceContentHash(source, 'global')
    expect(hashAfterCheckout).toBe(item.contentHash)
    expect(
      isSsgPageCacheValid({
        routePath,
        cacheItem: item,
        sourceContentHash: hashAfterCheckout,
        ssgPagesDir: pages,
      }),
    ).toBe(true)

    // Real content edit: cache entry must miss.
    fs.writeFileSync(source, '# Changed\n')
    expect(
      isSsgPageCacheValid({
        routePath,
        cacheItem: item,
        sourceContentHash: getSsgSourceContentHash(source, 'global'),
        ssgPagesDir: pages,
      }),
    ).toBe(false)
  })
})
