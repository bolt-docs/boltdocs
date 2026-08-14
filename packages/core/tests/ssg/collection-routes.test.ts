import { describe, expect, it, vi } from 'vitest'
import type { ComponentRoute } from '../../src/client/types'

// DocsLayout imports `virtual:boltdocs-layout`, which only resolves inside a
// Vite build. buildCollectionRoutes only renders it inside route elements, so
// a stub keeps this pure route-shape test importable.
vi.mock('../../src/client/app/docs-layout', () => ({
  DocsLayout: ({ children }: { children: React.ReactNode }) => children,
}))

import { buildCollectionRoutes } from '../../src/client/ssg/create-routes.collection'

function makePost(
  path: string,
  title: string,
  locale?: string,
): ComponentRoute {
  return {
    path,
    title,
    locale,
    collection: 'blog',
    filePath: '',
    componentPath: '',
    headings: [],
    frontmatter: {},
  } as ComponentRoute
}

const baseConfig = {
  base: '/docs',
  i18n: { defaultLocale: 'en', locales: ['en', 'es'] },
} as never

describe('buildCollectionRoutes post sub-paths', () => {
  it('keeps post child paths relative to the collection layout', () => {
    const { children } = buildCollectionRoutes({
      routesData: [
        makePost('/blog/boltdocs-3.3.0', '3.3.0'),
        makePost('/es/blog/boltdocs-3.2.0', '3.2.0', 'es'),
      ],
      config: baseConfig,
      mdxModules: {},
    })

    const enLayout = children.find((route) => route.path === '/docs/blog')
    const esLayout = children.find((route) => route.path === '/docs/es/blog')

    expect(enLayout).toBeDefined()
    expect(esLayout).toBeDefined()

    // Posts must be relative child paths so the router matches
    // /docs/blog/boltdocs-3.3.0 and the SSG emits dist/docs/blog/... — never
    // a root-level /blog/... that matches nothing.
    const enPostPaths = (enLayout!.children || []).map((route) => route.path)
    expect(enPostPaths).toContain('boltdocs-3.3.0')
    expect(enPostPaths.every((path) => !path.startsWith('/'))).toBe(true)

    const esPostPaths = (esLayout!.children || []).map((route) => route.path)
    expect(esPostPaths).toContain('boltdocs-3.2.0')
    expect(esPostPaths.every((path) => !path.startsWith('/'))).toBe(true)
  })

  it('produces relative SSG static paths for collection posts', () => {
    const { children } = buildCollectionRoutes({
      routesData: [makePost('/blog/boltdocs-3.3.0', '3.3.0')],
      config: baseConfig,
      mdxModules: {},
    })

    const enLayout = children.find((route) => route.path === '/docs/blog')
    // Skip the index record (path '' → getStaticPaths ['']) and pick the post.
    const postRoute = (enLayout!.children || []).find(
      (route) => route.getStaticPaths && route.path,
    )
    expect(postRoute).toBeDefined()
    // routesToPaths() joins a relative child path with the layout prefix
    // (/docs/blog) to produce the final /docs/blog/boltdocs-3.3.0.
    const staticPaths = postRoute!.getStaticPaths!()
    expect(staticPaths).toEqual(['boltdocs-3.3.0'])
  })

  it('handles already canonical base-prefixed post paths', () => {
    const { children } = buildCollectionRoutes({
      routesData: [makePost('/docs/blog/boltdocs-3.3.0', '3.3.0')],
      config: baseConfig,
      mdxModules: {},
    })

    const enLayout = children.find((route) => route.path === '/docs/blog')
    const postPaths = (enLayout!.children || []).map((route) => route.path)
    expect(postPaths).toContain('boltdocs-3.3.0')
  })

  it('keeps base-less post paths in metadata for route hints', () => {
    const { metadata } = buildCollectionRoutes({
      routesData: [makePost('/blog/boltdocs-3.3.0', '3.3.0')],
      config: baseConfig,
      mdxModules: {},
    })

    const postMeta = metadata.find(
      (route) => route.collection === 'blog' && route.title === '3.3.0',
    )
    expect(postMeta?.path).toBe('/blog/boltdocs-3.3.0')
    const indexMeta = metadata.find((route) => route.path === '/docs/blog')
    expect(indexMeta?.collection).toBe('blog')
  })
})
