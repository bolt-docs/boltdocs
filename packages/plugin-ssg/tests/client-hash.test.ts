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

  it('changes when a file is modified (mtime changes)', () => {
    const hash1 = computeClientCodeHash(root, 'docs', cacheDir)
    fs.writeFileSync(join(root, 'docs', 'index.md'), '# Changed')
    const hash2 = computeClientCodeHash(root, 'docs', cacheDir)
    // Writing the file updates its mtime → stat-based fallback detects it
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

  it('changes when mtime changes without content change (utimes)', () => {
    const hash1 = computeClientCodeHash(root, 'docs', cacheDir)
    const stat = fs.statSync(join(root, 'docs', 'index.md'))
    fs.utimesSync(
      join(root, 'docs', 'index.md'),
      stat.atime,
      new Date(stat.mtimeMs + 1000),
    )
    const hash2 = computeClientCodeHash(root, 'docs', cacheDir)
    // Stat-based fallback includes mtime → mtime change = hash change
    expect(hash2).not.toBe(hash1)
  })

  it('changes when framework dist code changes (workspace install)', () => {
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
    fs.writeFileSync(join(distDir, 'index.js'), 'export const a = 1;')

    const hash1 = computeClientCodeHash(root, 'docs', cacheDir)
    fs.writeFileSync(join(distDir, 'index.js'), 'export const b = 2;')
    const hash2 = computeClientCodeHash(root, 'docs', cacheDir)
    expect(hash2).not.toBe(hash1)
  })

  it('uses Sätteri manifest hash when manifest exists', () => {
    // Create a fake Sätteri manifest
    const manifestDir = join(root, '.boltdocs', 'compiled')
    fs.mkdirpSync(manifestDir)
    const manifest = {
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
    }
    fs.writeJsonSync(join(manifestDir, 'manifest.json'), manifest)

    const hash1 = computeClientCodeHash(root, 'docs', cacheDir)
    const hash2 = computeClientCodeHash(root, 'docs', cacheDir)
    expect(hash2).toBe(hash1)

    // Change manifest content → hash should change
    manifest.globalKey = 'xyz789'
    fs.writeJsonSync(join(manifestDir, 'manifest.json'), manifest)
    const hash3 = computeClientCodeHash(root, 'docs', cacheDir)
    expect(hash3).not.toBe(hash1)
  })
})
