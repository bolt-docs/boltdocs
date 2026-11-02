import { describe, expect, it, vi } from 'vitest'
import {
  createSearchDocuments,
  executeSearchIndexHook,
} from '../../src/node/plugins/search-contract'
import type { BoltdocsConfig } from '../../src/shared/types'
import type { RouteMeta } from '../../src/node/routes/types'

const routes = [
  {
    path: '/docs/intro',
    filePath: 'intro.md',
    title: 'Introduction',
    excerpt: 'Learn the basics.',
  },
] as RouteMeta[]

describe('search plugin contract', () => {
  it('creates stable page-level search documents', () => {
    expect(createSearchDocuments(routes)).toEqual([
      {
        id: '/docs/intro',
        path: '/docs/intro',
        title: 'Introduction',
        content: 'Learn the basics.',
        headings: [],
        frontmatter: {},
      },
    ])
  })

  it('falls back to the route description when full content is unavailable', () => {
    expect(
      createSearchDocuments([
        {
          path: '/docs/config',
          filePath: 'config.md',
          title: 'Configuration',
          description: 'Configure the documentation site.',
        } as RouteMeta,
      ]),
    ).toEqual([
      expect.objectContaining({
        content: 'Configure the documentation site.',
      }),
    ])
  })

  it('runs the complete search hook chain exactly once', async () => {
    const order: string[] = []
    type SearchParams = {
      documents: unknown[]
      routes: RouteMeta[]
    }
    const normalHook = vi.fn(
      async (_context: unknown, params: SearchParams) => {
        order.push('normal')
        return { ...params, last: 'normal' }
      },
    )
    const preHook = vi.fn(async (_context: unknown, params: SearchParams) => {
      order.push('pre')
      return { ...params, last: 'pre' }
    })
    const postHook = vi.fn(async (_context: unknown, params: SearchParams) => {
      order.push('post')
      return { ...params, last: 'post' }
    })
    const config = {
      plugins: [
        { name: 'normal', hooks: { 'search:index': normalHook } },
        { name: 'pre', enforce: 'pre', hooks: { 'search:index': preHook } },
        { name: 'post', enforce: 'post', hooks: { 'search:index': postHook } },
        { name: 'unrelated', hooks: {} },
      ],
    } as unknown as BoltdocsConfig

    const results = await executeSearchIndexHook(
      routes,
      config,
      '/project/docs',
      '/project',
    )

    // The hook now returns the entries to publish, not an opaque wrapper. The
    // chain runs once, in `pre → normal → post` order, and each plugin's
    // return value is threaded to the next.
    expect(order).toEqual(['pre', 'normal', 'post'])
    expect(preHook).toHaveBeenCalledOnce()
    expect(normalHook).toHaveBeenCalledOnce()
    expect(postHook).toHaveBeenCalledOnce()
    // These hooks thread a `last` marker but publish no entries, so the asset
    // stays unclaimed — `null` rather than an empty list.
    expect(results).toBeNull()
  })

  it('returns null when no plugin implements search indexing', async () => {
    // `null`, not `[]`: "no engine claimed the asset" and "an engine produced
    // zero entries" must not look alike, because only the first is worth
    // telling a user about.
    const config = {
      plugins: [{ name: 'unrelated', hooks: {} }],
    } as unknown as BoltdocsConfig

    await expect(
      executeSearchIndexHook(routes, config, '/project/docs', '/project'),
    ).resolves.toBeNull()
  })
})
