import { describe, it, expect } from 'vitest'
import {
  createManifestIndexes,
  computeRouteClientAssetHash,
} from '../src/node/client-dep-map'
import type { Manifest, SSRManifest } from '../src/node/types'

const makeManifest = (): Manifest => ({
  'assets/entry-abc123.js': {
    file: 'assets/entry-abc123.js',
    src: 'src/entry.ts',
    imports: ['assets/utils-xyz789.js', './dep.css'],
    css: ['./dep.css'],
    dynamicImports: ['assets/lazy-000.js'],
  },
  'assets/utils-xyz789.js': {
    file: 'assets/utils-xyz789.js',
    src: 'src/utils.ts',
    imports: [],
    css: [],
  },
  'assets/lazy-000.js': {
    file: 'assets/lazy-000.js',
    src: 'src/lazy.ts',
    imports: [],
    css: [],
  },
})

describe('createManifestIndexes', () => {
  it('indexes by file and by src', () => {
    const manifest = makeManifest()
    const { byFile, bySrc } = createManifestIndexes(manifest)
    expect(byFile.get('assets/entry-abc123.js')).toBe(
      manifest['assets/entry-abc123.js'],
    )
    expect(bySrc.get('src/entry.ts')).toBe(manifest['assets/entry-abc123.js'])
    expect(bySrc.get('src/utils.ts')).toBe(manifest['assets/utils-xyz789.js'])
  })
})

describe('computeRouteClientAssetHash', () => {
  it('uses pre-computed asset hashes in deterministic order', async () => {
    const manifest = makeManifest()
    const indexes = createManifestIndexes(manifest)
    const ssrManifest: SSRManifest = {}
    const assetHashes = new Map([
      ['assets/entry-abc123.js', 'hash1'],
      ['assets/utils-xyz789.js', 'hash2'],
      ['./dep.css', 'hash3'],
      ['assets/lazy-000.js', 'hash4'],
    ])

    const hash1 = await computeRouteClientAssetHash({
      outDir: '/out',
      indexes,
      ssrManifest,
      routeSourceFile: '/project/src/entry.ts',
      root: '/project',
      assetHashes,
    })
    const hash2 = await computeRouteClientAssetHash({
      outDir: '/out',
      indexes,
      ssrManifest,
      routeSourceFile: '/project/src/entry.ts',
      root: '/project',
      assetHashes,
    })

    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^[a-f0-9]{32}$/)
  })

  it('falls back to the global client hash when no route chunk matches', async () => {
    const hash = await computeRouteClientAssetHash({
      outDir: '/out',
      manifest: makeManifest(),
      ssrManifest: {},
      routeSourceFile: 'src/unknown.ts',
      root: '/project',
      clientHash: 'global-hash-abc',
    })
    expect(hash).toBe('global-hash-abc')
  })

  it('throws when no chunk and no client hash are available', async () => {
    await expect(
      computeRouteClientAssetHash({
        outDir: '/out',
        manifest: makeManifest(),
        ssrManifest: {},
        routeSourceFile: 'src/unknown.ts',
        root: '/project',
      }),
    ).rejects.toThrow(/no global client hash/)
  })

  it('collects chunks reachable from an SSR manifest mapping', async () => {
    const indexes = createManifestIndexes(makeManifest())
    const ssrManifest: SSRManifest = {
      'foo.tsx': ['assets/entry-abc123.js'],
    }
    const assetHashes = new Map([
      ['assets/entry-abc123.js', 'h1'],
      ['assets/utils-xyz789.js', 'h2'],
      ['./dep.css', 'h3'],
      ['assets/lazy-000.js', 'h4'],
    ])
    const hash = await computeRouteClientAssetHash({
      outDir: '/out',
      indexes,
      ssrManifest,
      routeSourceFile: 'foo.tsx',
      root: '/project',
      assetHashes,
    })
    expect(hash).toMatch(/^[a-f0-9]{32}$/)
    // The route source is not a client chunk itself, yet the SSR mapping
    // routes us to the entry chunk and its transitive dependencies.
    expect(hash).not.toBe('h1')
  })
})
