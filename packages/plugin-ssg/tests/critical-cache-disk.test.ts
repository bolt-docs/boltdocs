import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  CriticalCssCache,
  pruneCriticalCssDiskCache,
} from '../src/node/critical-cache'

function createTempDir(prefix: string): string {
  const dir = join(tmpdir(), `boltdocs-critters-disk-${prefix}-${Date.now()}`)
  fs.ensureDirSync(dir)
  return dir
}

/**
 * Disk writes are fire-and-forget (never blocking render), so tests must wait
 * until the payload has actually landed — a fixed sleep races with the async
 * write and made the corruption test flaky under load.
 */
async function waitForPersistedPayload(path: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      JSON.parse(fs.readFileSync(path, 'utf-8'))
      return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`payload never landed: ${path}`)
}

describe('CriticalCssCache persistent layer', () => {
  let root: string
  let cacheDir: string

  beforeEach(() => {
    root = createTempDir('root')
    cacheDir = join(root, 'critical-css')
  })

  afterEach(() => {
    try {
      fs.removeSync(root)
    } catch {}
  })

  it('extracts once, persists to disk, and hits disk on a second instance', async () => {
    let extractions = 0
    const first = new CriticalCssCache({ cacheDir })
    const style1 = await first.getOrCreate(
      'k1',
      () => {
        extractions++
        return '<style>.a{color:red}</style>'
      },
      { engine: 'zig-critters' },
    )
    expect(style1).toBe('<style>.a{color:red}</style>')
    expect(extractions).toBe(1)
    // Write is async — wait for the payload to land.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(fs.existsSync(join(cacheDir, 'critical-css-k1.json'))).toBe(true)

    // A brand-new cache (fresh process simulation) must not re-extract.
    const second = new CriticalCssCache({ cacheDir })
    const style2 = await second.getOrCreate(
      'k1',
      () => {
        extractions++
        return '<style>.a{color:red}</style>'
      },
      { engine: 'zig-critters' },
    )
    expect(style2).toBe('<style>.a{color:red}</style>')
    expect(extractions).toBe(1)
  })

  it('caches null (nothing to inline) without re-extracting', async () => {
    const cache = new CriticalCssCache({ cacheDir })
    let extractions = 0
    const extract = () => {
      extractions++
      return null
    }
    expect(
      await cache.getOrCreate('k-null', extract, { engine: 'zig-critters' }),
    ).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 20))
    const second = new CriticalCssCache({ cacheDir })
    expect(
      await second.getOrCreate('k-null', extract, { engine: 'zig-critters' }),
    ).toBeNull()
    expect(extractions).toBe(1)
  })

  it('does not reuse a payload written by another engine', async () => {
    const first = new CriticalCssCache({ cacheDir })
    await first.getOrCreate('k-eng', () => '<style>.a{}</style>', {
      engine: 'zig-critters',
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    const second = new CriticalCssCache({ cacheDir })
    let extracted = false
    const style = await second.getOrCreate(
      'k-eng',
      () => {
        extracted = true
        return '<style>.b{}</style>'
      },
      { engine: 'beasties' },
    )
    expect(extracted).toBe(true)
    expect(style).toBe('<style>.b{}</style>')
  })

  it('extracts again when the persisted payload is corrupted', async () => {
    const cache = new CriticalCssCache({ cacheDir })
    await cache.getOrCreate('k-bad', () => '<style>.a{}</style>', {
      engine: 'zig-critters',
    })
    await waitForPersistedPayload(join(cacheDir, 'critical-css-k-bad.json'))
    fs.writeFileSync(join(cacheDir, 'critical-css-k-bad.json'), '{broken')

    let extracted = false
    const second = new CriticalCssCache({ cacheDir })
    await second.getOrCreate(
      'k-bad',
      () => {
        extracted = true
        return '<style>.a2{}</style>'
      },
      { engine: 'zig-critters' },
    )
    expect(extracted).toBe(true)
  })

  it('works without a cacheDir (in-memory only, legacy behavior)', async () => {
    const cache = new CriticalCssCache()
    let calls = 0
    const [a, b] = await Promise.all([
      cache.getOrCreate('k', async () => {
        calls++
        await new Promise((resolve) => setTimeout(resolve, 5))
        return 'style'
      }),
      cache.getOrCreate('k', async () => {
        calls++
        await new Promise((resolve) => setTimeout(resolve, 5))
        return 'style'
      }),
    ])
    expect(calls).toBe(1)
    expect(a).toBe('style')
    expect(b).toBe('style')
  })

  it('still retries after an extraction failure', async () => {
    const cache = new CriticalCssCache({ cacheDir })
    let shouldFail = true
    const extract = () => {
      if (shouldFail) throw new Error('boom')
      return 'ok'
    }
    await expect(
      cache.getOrCreate('k-fail', extract, { engine: 'zig-critters' }),
    ).rejects.toThrow('boom')
    shouldFail = false
    await expect(
      cache.getOrCreate('k-fail', extract, { engine: 'zig-critters' }),
    ).resolves.toBe('ok')
  })
})

describe('pruneCriticalCssDiskCache', () => {
  let root: string
  let cacheDir: string

  beforeEach(() => {
    root = createTempDir('prune')
    cacheDir = join(root, 'critical-css')
    fs.ensureDirSync(cacheDir)
  })

  afterEach(() => {
    try {
      fs.removeSync(root)
    } catch {}
  })

  it('removes files older than the TTL and keeps fresh ones', async () => {
    const fresh = join(cacheDir, 'critical-css-fresh.json')
    const stale = join(cacheDir, 'critical-css-stale.json')
    fs.writeFileSync(fresh, '{"v":1}')
    fs.writeFileSync(stale, '{"v":1}')
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
    fs.utimesSync(stale, old, old)

    const pruned = await pruneCriticalCssDiskCache(cacheDir, {
      maxAgeMs: 30 * 24 * 60 * 60 * 1000,
    })
    expect(pruned).toBe(1)
    expect(fs.existsSync(fresh)).toBe(true)
    expect(fs.existsSync(stale)).toBe(false)
  })

  it('caps the directory at maxEntries, evicting least-recently used', async () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) {
      const file = join(cacheDir, `critical-css-e${i}.json`)
      fs.writeFileSync(file, '{"v":1}')
      const at = new Date(now - i * 1000) // e0 newest … e4 oldest
      fs.utimesSync(file, at, at)
    }
    const pruned = await pruneCriticalCssDiskCache(cacheDir, { maxEntries: 3 })
    expect(pruned).toBe(2)
    expect(fs.existsSync(join(cacheDir, 'critical-css-e0.json'))).toBe(true)
    expect(fs.existsSync(join(cacheDir, 'critical-css-e1.json'))).toBe(true)
    expect(fs.existsSync(join(cacheDir, 'critical-css-e2.json'))).toBe(true)
    expect(fs.existsSync(join(cacheDir, 'critical-css-e3.json'))).toBe(false)
    expect(fs.existsSync(join(cacheDir, 'critical-css-e4.json'))).toBe(false)
  })

  it('ignores unrelated files and missing directories', async () => {
    fs.writeFileSync(join(cacheDir, 'unrelated.json'), '{}')
    expect(await pruneCriticalCssDiskCache(cacheDir)).toBe(0)
    expect(await pruneCriticalCssDiskCache(join(root, 'missing'))).toBe(0)
    expect(fs.existsSync(join(cacheDir, 'unrelated.json'))).toBe(true)
  })
})
