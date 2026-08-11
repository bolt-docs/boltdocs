import crypto from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createSsgOutputState,
  getCanonicalRouteKey,
  getSsgOutputPageFiles,
  isClientCacheReusable,
  isSsgOutputReusable,
  readSsgOutputState,
  reconcileRouteCache,
  writeFileIfChanged,
  writeJsonIfChanged,
  writeSsgOutputState,
} from '../src/node/cache-io'
import {
  getNormalizedPathKey,
  serializeStaticLoaderDataManifest,
} from '../src/node/build'

const roots: string[] = []

const makeRoot = () => {
  const root = join(tmpdir(), `boltdocs-cache-io-${crypto.randomUUID()}`)
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.remove(root)))
})

describe('deterministic generated manifests', () => {
  it('does not prefix already absolute public route paths with the base', () => {
    expect(getNormalizedPathKey('/es', '/docs')).toBe('/es')
    expect(getNormalizedPathKey('/docs/es', '/docs')).toBe('/docs/es')
    expect(getNormalizedPathKey('/docs/es/', '/docs')).toBe('/docs/es')
  })

  it('serializes loader-data keys in lexical order', () => {
    expect(
      serializeStaticLoaderDataManifest({
        '/docs/zeta': 'zeta.json',
        '/': 'index.json',
        '/docs/alpha': 'alpha.json',
      }),
    ).toBe(
      '{"/":"index.json","/docs/alpha":"alpha.json","/docs/zeta":"zeta.json"}',
    )
  })
})

describe('idempotent cache writes', () => {
  it('writes missing text and skips an identical second write', async () => {
    const file = join(makeRoot(), 'nested', 'value.txt')

    await expect(writeFileIfChanged(file, 'stable')).resolves.toBe(true)
    const firstMtime = (await fs.stat(file)).mtimeMs

    await expect(writeFileIfChanged(file, 'stable')).resolves.toBe(false)
    await expect(fs.readFile(file, 'utf8')).resolves.toBe('stable')
    expect((await fs.stat(file)).mtimeMs).toBe(firstMtime)
  })

  it('canonicalizes active routes and drops removed cache entries', () => {
    const reconciled = reconcileRouteCache(
      {
        '': { value: 'home' },
        '/docs/intro/': { value: 'intro' },
        '/removed': { value: 'removed' },
      },
      ['/', '/docs/intro'],
    )

    expect(getCanonicalRouteKey('/')).toBe('')
    expect(reconciled).toEqual({
      '': { value: 'home' },
      '/docs/intro': { value: 'intro' },
    })
  })

  it('replaces malformed JSON and skips equivalent JSON', async () => {
    const file = join(makeRoot(), 'cache.json')

    await fs.ensureDir(join(file, '..'))
    await fs.writeFile(file, '{malformed')
    await expect(
      writeJsonIfChanged(file, { routes: ['/docs'] }, 0),
    ).resolves.toBe(true)
    await expect(fs.readJson(file)).resolves.toEqual({ routes: ['/docs'] })

    await expect(
      writeJsonIfChanged(file, { routes: ['/docs'] }, 0),
    ).resolves.toBe(false)
  })
})

describe('SSG output state', () => {
  it('reuses an unchanged output and rejects missing or stale files', async () => {
    const root = makeRoot()
    const out = join(root, 'dist')
    await fs.outputFile(join(out, 'assets/app.js'), 'client')
    await fs.outputFile(join(out, 'docs.html'), 'page')

    const state = createSsgOutputState(
      'hash-1',
      ['assets/app.js'],
      ['docs.html'],
    )
    expect(
      isSsgOutputReusable(
        state,
        'hash-1',
        out,
        ['assets/app.js'],
        ['docs.html'],
      ),
    ).toBe(true)

    await fs.remove(join(out, 'docs.html'))
    expect(
      isSsgOutputReusable(
        state,
        'hash-1',
        out,
        ['assets/app.js'],
        ['docs.html'],
      ),
    ).toBe(false)

    await fs.outputFile(join(out, 'docs.html'), 'page')
    expect(isSsgOutputReusable(state, 'hash-1', out, [], ['docs.html'])).toBe(
      false,
    )

    await fs.remove(join(out, 'assets/app.js'))
    expect(
      isSsgOutputReusable(
        state,
        'hash-1',
        out,
        ['assets/app.js'],
        ['docs.html'],
      ),
    ).toBe(false)
    await fs.outputFile(join(out, 'assets/app.js'), 'client')
    await fs.outputFile(join(out, 'stale.txt'), 'stale')
    expect(
      isSsgOutputReusable(
        state,
        'hash-1',
        out,
        ['assets/app.js'],
        ['docs.html'],
      ),
    ).toBe(false)
  })

  it('rejects missing or incomplete client cache inventories', () => {
    const state = createSsgOutputState(
      'hash',
      ['assets/app.js', 'assets/app.css'],
      ['index.html'],
    )

    expect(isClientCacheReusable(undefined, ['assets/app.js'])).toBe(false)
    expect(
      isClientCacheReusable(state, ['assets/app.js', 'assets/app.css']),
    ).toBe(true)
    expect(isClientCacheReusable(state, ['assets/app.js'])).toBe(false)
    expect(
      isClientCacheReusable(
        state,
        ['assets/app.js', 'assets/app.css', 'index.html'],
        'index.html',
      ),
    ).toBe(true)
  })

  it('rejects legacy output state without auxiliary files', async () => {
    const root = makeRoot()
    const stateFile = join(root, 'legacy-state.json')
    await fs.ensureDir(root)
    await fs.writeJson(stateFile, {
      cacheHash: 'legacy',
      clientFiles: ['assets/app.js'],
      pageFiles: ['index.html'],
    })

    await expect(readSsgOutputState(stateFile)).resolves.toBeUndefined()
  })

  it('uses an explicit final inventory without scanning the output directory', async () => {
    const root = makeRoot()
    const stateFile = join(root, 'ssg-output.json')

    await expect(
      writeSsgOutputState(
        stateFile,
        'hash',
        join(root, 'missing-dist'),
        ['index.html'],
        ['assets/app.js'],
        ['assets/app.js', 'index.html', 'sw.js'],
      ),
    ).resolves.toBe(true)

    await expect(readSsgOutputState(stateFile)).resolves.toEqual({
      cacheHash: 'hash',
      clientFiles: ['assets/app.js'],
      pageFiles: ['index.html'],
      auxiliaryFiles: ['sw.js'],
    })
  })

  it('persists and reads the canonical output inventory', async () => {
    const root = makeRoot()
    const out = join(root, 'dist')
    const stateFile = join(root, 'ssg-output.json')
    await fs.outputFile(join(out, 'assets/app.js'), 'client')
    await fs.outputFile(join(out, 'index.html'), 'home')
    await fs.outputFile(
      join(out, 'static-loader-data-manifest-hash.json'),
      '{}',
    )

    const pageFiles = ['index.html', 'static-loader-data-manifest-hash.json']
    await expect(
      writeSsgOutputState(stateFile, 'hash', out, pageFiles),
    ).resolves.toBe(true)
    await expect(readSsgOutputState(stateFile)).resolves.toEqual({
      cacheHash: 'hash',
      clientFiles: ['assets/app.js'],
      pageFiles,
      auxiliaryFiles: [],
    })

    expect(
      getSsgOutputPageFiles(
        ['/', '/docs'],
        {
          '': {},
          '/docs': { loaderDataFilePath: 'static-loader-data/docs.hash.json' },
        },
        'flat',
      ),
    ).toEqual(['index.html', 'docs.html', 'static-loader-data/docs.hash.json'])

    expect(
      getSsgOutputPageFiles(
        ['/', '/docs/'],
        {
          '': {},
          '/docs': {},
        },
        'nested',
      ),
    ).toEqual(['index.html', 'docs/index.html'])

    await fs.outputFile(join(out, 'sw.js'), 'service worker')
    await expect(
      writeSsgOutputState(stateFile, 'hash', out, pageFiles, ['assets/app.js']),
    ).resolves.toBe(true)
    await expect(readSsgOutputState(stateFile)).resolves.toMatchObject({
      auxiliaryFiles: ['sw.js'],
    })
  })
})
