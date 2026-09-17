import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { computeClientCodeHash } from '../src/node/client-hash'

function createFixtureDir(prefix: string): string {
  const dir = join(tmpdir(), `boltdocs-client-hash-${prefix}-${Date.now()}`)
  fs.mkdirpSync(dir)
  return dir
}

describe('computeClientCodeHash (PR-04: O(1) manifest hash)', () => {
  let root: string
  let cacheDir: string

  beforeEach(() => {
    root = createFixtureDir('root')
    cacheDir = createFixtureDir('cache')
    fs.mkdirpSync(join(root, 'docs'))
    fs.writeFileSync(join(root, 'docs', 'index.md'), '# Hello')
  })

  afterEach(() => {
    try {
      fs.removeSync(root)
    } catch {}
    try {
      fs.removeSync(cacheDir)
    } catch {}
  })

  it('returns the same hash when nothing changes (idempotent)', () => {
    const hash1 = computeClientCodeHash(root, 'docs', cacheDir)
    const hash2 = computeClientCodeHash(root, 'docs', cacheDir)
    expect(hash2).toBe(hash1)
  })

  it('changes when a file is modified (content changes)', () => {
    const hash1 = computeClientCodeHash(root, 'docs', cacheDir)
    fs.writeFileSync(join(root, 'docs', 'index.md'), '# Changed')
    const hash2 = computeClientCodeHash(root, 'docs', cacheDir)
    // Content-based hashing detects the different bytes
    expect(hash2).not.toBe(hash1)
  })

  it('changes when a file is renamed', () => {
    const hash1 = computeClientCodeHash(root, 'docs', cacheDir)
    fs.renameSync(
      join(root, 'docs', 'index.md'),
      join(root, 'docs', 'renamed.md'),
    )
    const hash2 = computeClientCodeHash(root, 'docs', cacheDir)
    expect(hash2).not.toBe(hash1)
  })

  it('changes when a file is deleted', () => {
    const hash1 = computeClientCodeHash(root, 'docs', cacheDir)
    fs.removeSync(join(root, 'docs', 'index.md'))
    const hash2 = computeClientCodeHash(root, 'docs', cacheDir)
    expect(hash2).not.toBe(hash1)
  })

  it('is stable when only mtimes change without content change (checkout scenario)', () => {
    const hash1 = computeClientCodeHash(root, 'docs', cacheDir)
    const stat = fs.statSync(join(root, 'docs', 'index.md'))
    fs.utimesSync(
      join(root, 'docs', 'index.md'),
      stat.atime,
      new Date(stat.mtimeMs + 1000),
    )
    const hash2 = computeClientCodeHash(root, 'docs', cacheDir)
    // Content-based inputs ignore mtime churn entirely: a checkout that
    // rewrites timestamps must not invalidate the client build cache.
    expect(hash2).toBe(hash1)
  })

  it('is stable when only mtimes change in framework dist (checkout scenario)', () => {
    // Simulate a pnpm workspace install: `boltdocs` symlinked into
    // node_modules. Framework code changes must invalidate the docs client
    // cache — otherwise a core rebuild is never picked up by the site.
    const nmDir = join(root, 'node_modules', 'boltdocs')
    const distDir = join(nmDir, 'dist')
    fs.mkdirpSync(distDir)
    fs.writeJsonSync(join(nmDir, 'package.json'), {
      name: 'boltdocs',
      version: '1.0.0',
    })
    // tsdown emits .mjs bundles — those must participate in the hash too
    // (an earlier stat-only pass only matched .js and missed them).
    fs.writeFileSync(join(distDir, 'index.mjs'), 'export const a = 1;')

    const hash1 = computeClientCodeHash(root, 'docs', cacheDir)
    fs.writeFileSync(join(distDir, 'index.mjs'), 'export const b = 2;')
    const hash2 = computeClientCodeHash(root, 'docs', cacheDir)
    expect(hash2).not.toBe(hash1)

    // Pure mtime rewrite of the dist file must NOT change the hash
    const stat = fs.statSync(join(distDir, 'index.mjs'))
    fs.utimesSync(
      join(distDir, 'index.mjs'),
      stat.atime,
      new Date(stat.mtimeMs + 5000),
    )
    expect(computeClientCodeHash(root, 'docs', cacheDir)).toBe(hash2)
  })

  it('ignores the Sätteri manifest entirely (no build-order lag)', () => {
    // The precompile manifest is only rewritten during the client build, so
    // hashing it made the client hash lag one build behind content edits.
    // The hash reads MDX bytes directly instead: manifest-only changes —
    // globalKey, content hashes, mtimes — must NOT move the client hash.
    const manifestDir = join(root, '.boltdocs', 'compiled')
    fs.mkdirpSync(manifestDir)
    fs.writeJsonSync(join(manifestDir, 'manifest.json'), {
      version: 1,
      globalKey: 'abc123',
      files: {
        'docs/index.md': {
          contentHash: 'def456',
          exportName: '_p_aaa',
          outFile: '/tmp/out.mjs',
          mtime: 1234567890,
        },
      },
    })
    const hash1 = computeClientCodeHash(root, 'docs', cacheDir)

    // Manifest-only rewrite (same MDX bytes on disk)
    fs.writeJsonSync(join(manifestDir, 'manifest.json'), {
      version: 1,
      globalKey: 'xyz789',
      files: {
        'docs/index.md': {
          contentHash: 'aaa-bbb',
          exportName: '_p_zzz',
          outFile: '/tmp/other.mjs',
          mtime: 999,
        },
      },
    })
    expect(computeClientCodeHash(root, 'docs', cacheDir)).toBe(hash1)

    // But the underlying MDX content does move the hash: page text flows
    // into the client bundle via route chunks and the search index.
    fs.writeFileSync(join(root, 'docs', 'index.md'), '# New content')
    expect(computeClientCodeHash(root, 'docs', cacheDir)).not.toBe(hash1)
  })

  it('ignores lockfile mtime churn (lockfile-only refresh scenario)', () => {
    fs.writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n')
    const hash1 = computeClientCodeHash(root, 'docs', cacheDir)
    const stat = fs.statSync(join(root, 'pnpm-lock.yaml'))
    fs.utimesSync(
      join(root, 'pnpm-lock.yaml'),
      stat.atime,
      new Date(stat.mtimeMs + 1000),
    )
    // Lockfiles are excluded from the hash: their bytes never enter the
    // bundle, and checkout/install rewrites them without changing output.
    expect(computeClientCodeHash(root, 'docs', cacheDir)).toBe(hash1)
  })
})
