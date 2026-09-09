import { describe, expect, it } from 'vitest'
import { collectAssets, createAssetCollector } from '../src/node/assets'

describe('collectAssets', () => {
  it('memoizes concurrent collection for the same location', async () => {
    let matcherCalls = 0
    const matcher = (routes: any[], pathname: string, base?: string) => {
      matcherCalls++
      expect(pathname).toBe('/docs/intro')
      expect(base).toBe('/docs')
      return [{ route: routes[0], params: {} }]
    }

    const collect = createAssetCollector({
      routes: [{ path: 'intro', entry: 'src/intro.tsx' }],
      base: '/docs',
      matchRouteBranchWithParams: matcher,
      serverManifest: {},
      manifest: {
        'src/intro.tsx': {
          file: 'assets/intro.js',
        },
      },
      ssrManifest: {
        'src/intro.tsx': ['assets/intro.js'],
      },
    })

    const [first, second] = await Promise.all([
      collect('/docs/intro'),
      collect('/docs/intro'),
    ])

    expect(first).toEqual(new Set(['assets/intro.js']))
    expect(second).toEqual(first)
    expect(matcherCalls).toBe(1)
  })

  it('includes dynamic imports for localized base paths', async () => {
    const matcher = (routes: any[], pathname: string, base?: string) => {
      expect(pathname).toBe('/es/docs/intro')
      expect(base).toBe('/es/docs')
      return [{ route: routes[0], params: {} }]
    }

    const lazyRoute = () => Promise.resolve({})
    Object.defineProperty(lazyRoute, 'toString', {
      value: () => '() => import("lazy-route.js")',
    })

    const assets = await collectAssets({
      routes: [
        {
          path: 'intro',
          entry: 'src/intro.tsx',
          lazy: lazyRoute,
        },
      ],
      locationArg: '/es/docs/intro',
      base: '/es/docs',
      matchRouteBranchWithParams: matcher,
      serverManifest: {
        'lazy-route.js': {
          file: 'assets/lazy-route.js',
        },
      },
      manifest: {
        'src/intro.tsx': {
          file: 'assets/intro.js',
        },
        'lazy-route.js': {
          file: 'assets/lazy-route.js',
        },
      },
      ssrManifest: {
        'src/intro.tsx': ['assets/intro.js'],
        'lazy-route.js': ['assets/lazy-route.js'],
      },
    })

    expect(assets).toEqual(new Set(['assets/intro.js', 'assets/lazy-route.js']))
  })

  it('uses the SSR entry matcher instead of a DOM router dependency', async () => {
    const matcher = (routes: any[], pathname: string, base?: string) => {
      expect(pathname).toBe('/docs/intro')
      expect(base).toBe('/docs')
      return [{ route: routes[0], params: {} }]
    }

    const assets = await collectAssets({
      routes: [{ path: 'intro', entry: 'src/intro.tsx' }],
      locationArg: '/docs/intro',
      base: '/docs',
      matchRouteBranchWithParams: matcher,
      serverManifest: {},
      manifest: {
        'src/intro.tsx': {
          file: 'assets/intro.js',
        },
      },
      ssrManifest: {
        'src/intro.tsx': ['assets/intro.js'],
      },
    })

    expect(assets).toEqual(new Set(['assets/intro.js']))
  })
})
