import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import type { RouteRecord } from '../src/types'
import {
  attachSsgRouteManifest,
  createSsgBuildSnapshot,
  createSsgRouteManifest,
} from '../src/node/pipeline/snapshot'

describe('SSG build snapshot', () => {
  it('normalizes source paths and canonical route keys', () => {
    const snapshot = createSsgBuildSnapshot({
      root: '/project',
      outDir: '/project/dist',
      cacheDir: '/project/.boltdocs/build',
      base: '/docs/',
      mode: 'production',
      entry: 'virtual:boltdocs-entry',
      htmlEntry: 'index.html',
      docsDirName: 'docs',
      clientHash: 'client-hash',
      routeToSourceFileMap: {
        '/docs/guide/': 'docs/guide/index.mdx',
        '/': '/project/docs/index.mdx',
      },
    })

    expect(snapshot.sourceFiles).toEqual({
      '/docs/guide': join('/project', 'docs/guide/index.mdx'),
      '': '/project/docs/index.mdx',
    })
    expect(snapshot.base).toBe('/docs/')
    expect(snapshot.clientHash).toBe('client-hash')
  })

  it('creates a stable route manifest without changing route paths', () => {
    const routes = [
      {
        path: '/docs/guide',
        componentPath: '/project/docs/guide.mdx',
        locale: 'en',
        version: 'latest',
      },
      {
        path: '/docs/guide/',
        componentPath: '/project/docs/guide-es.mdx',
        locale: 'es',
      },
    ] as RouteRecord[]

    const manifest = createSsgRouteManifest('/project', routes, {
      '/docs/guide': 'docs/guide.mdx',
      '/docs/guide/': 'docs/guide-es.mdx',
    })

    expect(manifest.routes).toHaveLength(2)
    expect(manifest.routes.map((route) => route.path)).toEqual([
      '/docs/guide',
      '/docs/guide/',
    ])
    expect(manifest.byPath.get('/docs/guide')?.locale).toBe('en')
    expect(manifest.byPath.get('/docs/guide')?.sourceFile).toBe(
      '/project/docs/guide.mdx',
    )
    expect(manifest.byPath.get('/docs/guide')?.version).toBe('latest')
    expect(manifest.byPath.size).toBe(1)
  })

  it('attaches the route manifest without mutating the original snapshot', () => {
    const snapshot = createSsgBuildSnapshot({
      root: '/project',
      outDir: '/project/dist',
      cacheDir: '/project/.boltdocs/build',
      base: '/',
      mode: 'production',
      entry: 'entry',
      htmlEntry: 'index.html',
      docsDirName: 'docs',
      clientHash: 'hash',
    })
    const manifest = createSsgRouteManifest('/project', [])
    const next = attachSsgRouteManifest(snapshot, manifest)

    expect(snapshot.routeManifest).toBeUndefined()
    expect(next.routeManifest).toBe(manifest)
    expect(next.root).toBe(snapshot.root)
  })
})
