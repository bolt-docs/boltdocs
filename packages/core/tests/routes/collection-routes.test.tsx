import { describe, it, expect, vi } from 'vitest'
import { createRoutes } from '../../src/client/ssg/create-routes'
import { matchRouteBranch } from '../../src/client/router/renderer'
import type { ComponentRoute } from '../../src/client/types'

vi.mock('virtual:boltdocs-search', () => ({ default: async () => [] }))
vi.mock('virtual:boltdocs-icons', () => ({ default: {} }))
vi.mock('virtual:boltdocs-mdx-components', () => ({ default: {} }))
vi.mock('virtual:boltdocs-layout', () => ({ default: {} }))

describe('collection route matching', () => {
  it('matches the collection index under the docs base alongside docs routes', () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/docs/api',
        filePath: 'docs/api.md',
        title: 'API',
      },
      {
        path: '/blog/hello-world',
        filePath: '[blog]/hello-world.md',
        title: 'Hello',
        collection: 'blog',
      },
    ]

    const config = {
      base: '/docs',
      i18n: {
        defaultLocale: 'en',
        locales: { en: { label: 'English' }, es: { label: 'Spanish' } },
      },
    }

    const result = createRoutes({
      routesData,
      config,
      mdxModules: {},
    })

    // The collection layout lives under the docs base. A root-level /blog
    // must not resolve to the collection (only the NotFound catch-all).
    const branch = matchRouteBranch(result.routes, '/docs/blog')
    expect(branch.map((r) => r.path)).toContain('/docs/blog')
    expect(
      matchRouteBranch(result.routes, '/blog').map((r) => r.path),
    ).not.toContain('/docs/blog')
  })

  it('matches /docs/blog to the collection list', () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/blog/hello-world',
        filePath: '[blog]/hello-world.md',
        title: 'Hello',
        collection: 'blog',
      },
    ]

    const config = {
      base: '/docs',
      i18n: {
        defaultLocale: 'en',
        locales: { en: { label: 'English' }, es: { label: 'Spanish' } },
      },
    }

    const result = createRoutes({
      routesData,
      config,
      mdxModules: {},
    })

    const branch = matchRouteBranch(result.routes, '/docs/blog')
    const paths = branch.map((r) => r.path)
    expect(paths).toContain('/docs/blog')
  })

  it('keeps a collection route when it only has _index.md', () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/blog',
        filePath: '[blog]/_index.md',
        title: 'Blog',
        collection: 'blog',
      },
    ]

    const config = {
      base: '/docs',
      i18n: {
        defaultLocale: 'en',
        locales: { en: { label: 'English' }, es: { label: 'Spanish' } },
      },
    }

    const result = createRoutes({
      routesData,
      config,
      mdxModules: {},
    })

    const branch = matchRouteBranch(result.routes, '/docs/blog')
    expect(branch.some((route) => route.path === '/docs/blog')).toBe(true)
    expect(branch.at(-1)?.index).toBe(true)
  })

  it('wires _index.md content into the collection landing route', async () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/blog',
        filePath: '[blog]/_index.md',
        title: 'Blog landing',
        description: 'A collection landing page',
        collection: 'blog',
      },
    ]

    const config = {
      base: '/docs',
      i18n: {
        defaultLocale: 'en',
        locales: { en: { label: 'English' }, es: { label: 'Spanish' } },
      },
    }

    const result = createRoutes({
      routesData,
      config,
      mdxModules: {
        '[blog]/_index.md': { default: () => null },
      },
    })

    const collectionRoute = result.routes[0]?.children?.find(
      (route) => route.path === '/docs/blog',
    )
    const indexRoute = collectionRoute?.children?.find((route) => route.index)

    expect(indexRoute).toBeDefined()
    if (!indexRoute?.loader) throw new Error('Collection index loader missing')

    expect(
      await indexRoute.loader({
        request: new Request('http://localhost/docs/blog'),
        params: {},
      }),
    ).toMatchObject({
      frontmatter: {
        title: 'Blog landing',
        description: 'A collection landing page',
      },
      filePath: '[blog]/_index.md',
    })
    expect(indexRoute.lazy).toBeDefined()
    if (!indexRoute.lazy) throw new Error('Collection index lazy route missing')
    expect((await indexRoute.lazy()).Component).toBeTypeOf('function')
  })

  it('matches /docs/blog/hello-world to a post', () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/blog/hello-world',
        filePath: '[blog]/hello-world.md',
        title: 'Hello',
        collection: 'blog',
      },
    ]

    const config = {
      base: '/docs',
      i18n: {
        defaultLocale: 'en',
        locales: { en: { label: 'English' }, es: { label: 'Spanish' } },
      },
    }

    const result = createRoutes({
      routesData,
      config,
      mdxModules: {},
    })

    const branch = matchRouteBranch(result.routes, '/docs/blog/hello-world')
    const paths = branch.map((r) => r.path)
    expect(paths).toContain('hello-world')
    // The base-less root-level URL must not resolve to the post anymore.
    expect(
      matchRouteBranch(result.routes, '/blog/hello-world').map((r) => r.path),
    ).not.toContain('hello-world')
  })
})
