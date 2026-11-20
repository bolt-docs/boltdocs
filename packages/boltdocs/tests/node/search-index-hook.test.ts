import { describe, expect, it, vi } from 'vitest'
import {
  createSearchDocuments,
  executeSearchIndexHook,
} from '../../src/node/plugins/search-contract'
import { setSearchEntries } from '../../src/node/search/registry'
import type { PluginContext, RouteMeta } from '@bdocs/contracts'

const route = (path: string, overrides: Partial<RouteMeta> = {}) =>
  ({
    path,
    filePath: `${path}.mdx`,
    title: path,
    ...overrides,
  }) as RouteMeta

const baseConfig = {
  plugins: [],
} as never

describe('createSearchDocuments', () => {
  it('flattens routes into the engine-facing shape', () => {
    const docs = createSearchDocuments([
      route('/a', {
        title: 'Alpha',
        _content: 'body text',
        headings: [{ level: 2, text: 'H', id: 'h' }],
        frontmatter: { tags: 'x' },
        locale: 'es',
      } as never),
    ])

    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      id: '/a',
      path: '/a',
      title: 'Alpha',
      content: 'body text',
      locale: 'es',
    })
    expect(docs[0].headings).toHaveLength(1)
    expect(docs[0].frontmatter).toEqual({ tags: 'x' })
  })

  it('falls back through excerpt and description for content', () => {
    const [withExcerpt] = createSearchDocuments([
      route('/a', { excerpt: 'the excerpt' } as never),
    ])
    const [withDescription] = createSearchDocuments([
      route('/b', { description: 'the description' } as never),
    ])

    expect(withExcerpt.content).toBe('the excerpt')
    expect(withDescription.content).toBe('the description')
  })

  it('falls back to the file path for an id when a route has none', () => {
    const [doc] = createSearchDocuments([
      { filePath: 'orphan.mdx' } as RouteMeta,
    ])

    expect(doc.id).toBe('orphan.mdx')
    expect(doc.title).toBe('')
  })
})

describe('executeSearchIndexHook', () => {
  it('returns null when no plugin implements the hook', async () => {
    const config = {
      plugins: [{ name: 'p', version: '1', hooks: {} }],
    } as never

    expect(
      await executeSearchIndexHook([route('/a')], config, '', ''),
    ).toBeNull()
  })

  it('hands the documents to every engine plugin and returns its entries', async () => {
    const seen: unknown[][] = []
    const engine = {
      name: 'engine',
      version: '1.0.0',
      hooks: {
        'search:index': (
          _ctx: PluginContext,
          params: { documents: unknown[]; routes: unknown[] },
        ) => {
          seen.push(params.documents)
          return {
            ...params,
            entries: [
              {
                id: '/a',
                title: 'A',
                content: '',
                url: '/a',
                display: 'A',
              },
            ],
          }
        },
      },
    }

    const entries = await executeSearchIndexHook(
      [route('/a')],
      { plugins: [engine] } as never,
      '',
      '',
    )

    expect(seen).toHaveLength(1)
    expect(seen[0]).toHaveLength(1)
    expect(entries).toHaveLength(1)
    expect(entries?.[0].url).toBe('/a')
  })

  it('threads params through several engine plugins in order', async () => {
    // `runChain` executes each plugin once and passes the result on. The
    // previous implementation called the hook once per plugin, which multiplied
    // the chain and could feed a later plugin duplicate data.
    const order: string[] = []
    const make = (name: string) => ({
      name,
      version: '1.0.0',
      hooks: {
        'search:index': (
          _ctx: PluginContext,
          params: { documents: unknown[] },
        ) => {
          order.push(name)
          return { ...params, entries: [] }
        },
      },
    })

    await executeSearchIndexHook(
      [route('/a')],
      { plugins: [make('first'), make('second')] } as never,
      '',
      '',
    )

    expect(order).toEqual(['first', 'second'])
  })

  it('returns null when an engine declines to produce entries', async () => {
    // An engine that builds its own index (Algolia, Pagefind) says so by
    // returning params without `entries`. Publishing the generated ones anyway
    // would leave an asset no client reads.
    const engine = {
      name: 'engine',
      version: '1.0.0',
      hooks: {
        'search:index': (
          _ctx: PluginContext,
          params: { documents: unknown[]; routes: unknown[] },
        ) => params,
      },
    }

    expect(
      await executeSearchIndexHook(
        [route('/a')],
        { plugins: [engine] } as never,
        '',
        '',
      ),
    ).toBeNull()
  })

  it('survives an engine hook that throws', async () => {
    const warn = vi.fn()
    const broken = {
      name: 'broken',
      version: '1.0.0',
      hooks: {
        'search:index': () => {
          throw new Error('index exploded')
        },
      },
    }

    // A failed index upload must not take down the build — `runChain` reports
    // through the plugin logger and continues.
    const result = await executeSearchIndexHook(
      [route('/a')],
      { plugins: [broken] } as never,
      '',
      '',
    )
    void warn

    expect(result).toBeNull()
  })
})

describe('engine entries override the default generator', () => {
  it('replaces rather than merges', async () => {
    const engine = {
      name: 'engine',
      version: '1.0.0',
      hooks: {
        'search:index': (
          _ctx: PluginContext,
          params: { documents: unknown[]; routes: unknown[] },
        ) => ({
          ...params,
          entries: [
            {
              id: 'only',
              title: 'Only',
              content: '',
              url: '/only',
              display: 'Only',
            },
          ],
        }),
      },
    }

    const entries = await executeSearchIndexHook(
      [route('/a'), route('/b')],
      { plugins: [engine] } as never,
      '',
      '',
    )
    setSearchEntries(entries)
    setSearchEntries(null)

    // Two routes produced exactly one engine entry: the engine's index is not
    // the generated index with extras appended.
    expect(entries).toHaveLength(1)
    expect(entries?.[0].id).toBe('only')
  })
})
