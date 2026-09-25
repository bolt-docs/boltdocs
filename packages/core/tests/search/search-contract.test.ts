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

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ last: 'post' })
    expect(order).toEqual(['pre', 'normal', 'post'])
    expect(preHook).toHaveBeenCalledOnce()
    expect(normalHook).toHaveBeenCalledOnce()
    expect(postHook).toHaveBeenCalledOnce()
  })

  it('does not run a chain when no plugin implements search indexing', async () => {
    const config = {
      plugins: [{ name: 'unrelated', hooks: {} }],
    } as unknown as BoltdocsConfig

    await expect(
      executeSearchIndexHook(routes, config, '/project/docs', '/project'),
    ).resolves.toEqual([])
  })
})
