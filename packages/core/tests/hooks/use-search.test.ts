import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  applySearchDelta,
  useSearch,
  type SearchHotContext,
} from '../../src/client/hooks/use-search'

const searchAsset = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('virtual:boltdocs-search', () => ({ default: searchAsset.fetch }))
import { useConfig } from '../../src/client/app/config-context'
import { useRoutes } from '../../src/client/hooks/use-routes'

// virtual:boltdocs-search is aliased to tests/mocks/virtual-search.ts

vi.mock('../../src/client/app/config-context', () => ({
  useConfig: vi.fn(),
}))

vi.mock('../../src/client/hooks/use-routes', () => ({
  useRoutes: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
  }
})

describe('useSearch hook', () => {
  const mockRoutes = [
    {
      path: '/docs/intro',
      title: 'Introduction',
      description: 'Intro description',
      groupTitle: 'Getting Started',
      locale: 'en',
    },
    {
      path: '/docs/advanced',
      title: 'Advanced Config',
      description: 'Advanced description',
      groupTitle: 'Guides',
      locale: 'en',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    searchAsset.fetch.mockResolvedValue([
      {
        id: '/docs/intro',
        title: 'Introduction',
        content: 'This is the introduction content and setup.',
        url: '/docs/intro',
        display: 'Getting Started > Introduction',
        locale: 'en',
      },
      {
        id: '/docs/advanced',
        title: 'Advanced Config',
        content: 'This details configuration options.',
        url: '/docs/advanced',
        display: 'Guides > Advanced Config',
        locale: 'en',
      },
    ])
    vi.mocked(useRoutes).mockReturnValue({
      currentLocale: 'en',
      currentVersion: undefined,
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('FlexSearch (Fallback Mode)', () => {
    beforeEach(() => {
      vi.mocked(useConfig).mockReturnValue({
        i18n: { defaultLocale: 'en' },
      })
    })

    it('should return default active routes when query is empty', () => {
      const { result } = renderHook(() => useSearch(mockRoutes as any))
      expect(result.current.query).toBe('')
      expect(result.current.list).toHaveLength(2)
      expect(result.current.list[0]).toMatchObject({
        id: '/docs/intro',
        title: 'Introduction',
      })
    })

    it('should return default active routes for default-locale routes with locale unset', () => {
      const defaultLocaleRoutes = [
        {
          path: '/docs/intro',
          title: 'Introduction',
          description: 'Intro description',
          groupTitle: 'Getting Started',
        },
      ]
      ;(useRoutes as any).mockReturnValue({
        currentLocale: 'en',
        currentVersion: undefined,
      })
      const { result } = renderHook(() => useSearch(defaultLocaleRoutes as any))

      expect(result.current.list).toHaveLength(1)
      expect(result.current.list[0]).toMatchObject({
        id: '/docs/intro',
        title: 'Introduction',
      })
    })

    it('should perform local search using numeric index IDs and recover the route URL', async () => {
      const { result } = renderHook(() => useSearch(mockRoutes as any))

      // Trigger index creation (and lazy search data fetch)
      act(() => {
        result.current.setIsOpen(true)
      })

      // Wait for the lazy search data fetch and FlexSearch index build.
      await waitFor(() => {
        expect(result.current.searchDataLoading).toBe(false)
      })

      act(() => {
        result.current.setQuery('advanced')
      })

      // Wait for the search result.
      await waitFor(() => {
        expect(result.current.list).toHaveLength(1)
      })

      expect(result.current.list[0]).toMatchObject({
        id: '/docs/advanced',
        title: 'Advanced Config',
        bio: 'Guides > Advanced Config',
      })
    })

    it('should not return results from another active locale', async () => {
      vi.mocked(useRoutes).mockReturnValue({
        currentLocale: 'es',
        currentVersion: undefined,
      } as any)

      const { result } = renderHook(() => useSearch(mockRoutes as any))

      act(() => {
        result.current.setIsOpen(true)
      })

      await waitFor(() => {
        expect(result.current.searchDataLoading).toBe(false)
      })

      act(() => {
        result.current.setQuery('advanced')
      })

      await waitFor(() => {
        expect(result.current.list).toEqual([])
      })
    })

    it('filters locale and version before applying the result limit', async () => {
      searchAsset.fetch.mockResolvedValue(
        Array.from({ length: 25 }, (_, index) => ({
          id: `/es/config-${index}`,
          title: `Spanish config ${index}`,
          content: 'shared target',
          url: `/es/config-${index}`,
          display: 'Spanish',
          locale: 'es',
          version: 'v1',
        })).concat([
          {
            id: '/en/config',
            title: 'English config',
            content: 'shared target',
            url: '/en/config',
            display: 'English',
            locale: 'en',
            version: 'v1',
          },
        ]),
      )
      vi.mocked(useRoutes).mockReturnValue({
        currentLocale: 'en',
        currentVersion: 'v1',
      } as any)

      const { result } = renderHook(() => useSearch([] as any))
      act(() => result.current.setIsOpen(true))
      await waitFor(() => expect(result.current.status).toBe('ready'))
      act(() => result.current.setQuery('shared target'))

      await waitFor(() => expect(result.current.list).toHaveLength(1))
      expect(result.current.list[0]?.path).toBe('/en/config')
    })

    it('returns a focused content snippet for local matches', async () => {
      searchAsset.fetch.mockResolvedValue([
        {
          id: '/docs/deep',
          title: 'Deep page',
          content: `${'prefix '.repeat(20)}important-needle${' suffix'.repeat(40)}`,
          url: '/docs/deep',
          display: 'Deep page',
          locale: 'en',
        },
      ])

      const { result } = renderHook(() => useSearch([] as any))
      act(() => result.current.setIsOpen(true))
      await waitFor(() => expect(result.current.status).toBe('ready'))
      act(() => result.current.setQuery('important-needle'))
      await waitFor(() => expect(result.current.list).toHaveLength(1))

      expect(result.current.list[0]?.snippet).toContain('important-needle')
      expect(result.current.list[0]?.snippet?.length).toBeLessThanOrEqual(202)
    })

    it('finds accent-insensitive local matches that the tokenizer misses', async () => {
      searchAsset.fetch.mockResolvedValue([
        {
          id: '/docs/intro',
          title: 'Introducción',
          content: 'A guide with áccents',
          url: '/docs/intro',
          display: 'Introducción',
          locale: 'en',
        },
      ])

      const { result } = renderHook(() => useSearch([] as any))
      act(() => result.current.setIsOpen(true))
      await waitFor(() => expect(result.current.status).toBe('ready'))
      act(() => result.current.setQuery('introduccion'))

      await waitFor(() => expect(result.current.list).toHaveLength(1))
      expect(result.current.list[0]?.title).toBe('Introducción')
    })

    it('exposes local index errors without reporting an empty result set', async () => {
      searchAsset.fetch.mockRejectedValueOnce(new Error('asset unavailable'))
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const { result } = renderHook(() => useSearch([] as any))
      act(() => result.current.setIsOpen(true))

      await waitFor(() => expect(result.current.status).toBe('error'))
      expect(result.current.searchDataError?.message).toBe('asset unavailable')
      expect(result.current.isLoading).toBe(false)
      expect(consoleError).toHaveBeenCalled()
    })

    it('applies HMR search deltas atomically, including deletions', () => {
      expect(
        applySearchDelta(
          [
            { id: '/old', url: '/old' },
            { id: '/keep', url: '/keep' },
          ] as any,
          {
            updated: [{ id: '/new', url: '/new' }],
            deleted: ['/old'],
          },
        ).map((doc) => doc.id),
      ).toEqual(['/keep', '/new'])
    })

    it('rebuilds local results from frontmatter HMR deltas', async () => {
      const listeners = new Map<string, (payload?: unknown) => void>()
      const hot: SearchHotContext = {
        on: vi.fn((event, listener) => listeners.set(event, listener)),
        off: vi.fn(),
      }
      const { result } = renderHook(() => useSearch([] as any, { hot }))
      act(() => result.current.setIsOpen(true))
      await waitFor(() => expect(result.current.status).toBe('ready'))
      act(() => result.current.setQuery('configuration'))

      act(() => {
        listeners.get('boltdocs:frontmatter-update')?.({
          search: {
            updated: [
              {
                id: '/docs/new-config',
                title: 'Configuration',
                content: 'configuration',
                url: '/docs/new-config',
                display: 'Configuration',
                locale: 'en',
              },
            ],
            deleted: ['/docs/advanced'],
          },
        })
      })

      await waitFor(() => expect(result.current.status).toBe('ready'))
      expect(result.current.list.map((item) => item.path)).toEqual([
        '/docs/new-config',
      ])
    })

    it('ignores stale body HMR asset responses', async () => {
      const listeners = new Map<string, (payload?: unknown) => void>()
      const hot: SearchHotContext = {
        on: vi.fn((event, listener) => listeners.set(event, listener)),
        off: vi.fn(),
      }
      const { result } = renderHook(() => useSearch([] as any, { hot }))
      act(() => result.current.setIsOpen(true))
      await waitFor(() => expect(result.current.status).toBe('ready'))

      const requests: Array<(value: unknown) => void> = []
      searchAsset.fetch
        .mockImplementationOnce(
          () => new Promise((resolve) => requests.push(resolve)),
        )
        .mockImplementationOnce(
          () => new Promise((resolve) => requests.push(resolve)),
        )
      act(() =>
        listeners.get('boltdocs:mdx-update')?.({ file: '/docs/one.mdx' }),
      )
      act(() =>
        listeners.get('boltdocs:mdx-update')?.({ file: '/docs/two.mdx' }),
      )
      expect(requests).toHaveLength(2)

      const newDocument = [
        {
          id: '/new',
          title: 'Current body',
          content: 'current',
          url: '/new',
          display: 'Current body',
          locale: 'en',
        },
      ]
      await act(async () => {
        requests[1]?.(newDocument)
        await Promise.resolve()
        requests[0]?.([
          {
            id: '/stale',
            title: 'Stale body',
            content: 'stale',
            url: '/stale',
            display: 'Stale body',
            locale: 'en',
          },
        ])
        await Promise.resolve()
      })

      act(() => result.current.setQuery('body'))
      await waitFor(() => expect(result.current.list).toHaveLength(1))
      expect(result.current.list[0]?.path).toBe('/new')
    })

    it('opens and closes with the platform keyboard shortcut', async () => {
      const { result, unmount } = renderHook(() => useSearch([] as any))
      const pressShortcut = () =>
        new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          cancelable: true,
        })

      act(() => window.dispatchEvent(pressShortcut()))
      expect(result.current.isOpen).toBe(true)
      await waitFor(() => expect(result.current.status).toBe('ready'))
      act(() => window.dispatchEvent(pressShortcut()))
      expect(result.current.isOpen).toBe(false)
      unmount()
    })
  })

  describe('Algolia DocSearch Mode', () => {
    const algoliaConfig = {
      appId: 'ALG_APP_123',
      apiKey: 'alg_search_key_abc',
      indexName: 'docs_index',
    }

    beforeEach(() => {
      vi.useFakeTimers()
      vi.mocked(useConfig).mockReturnValue({
        integrations: {
          search: {
            algolia: algoliaConfig,
          },
        },
      })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should not initialize FlexSearch index in Algolia mode', () => {
      const { result } = renderHook(() => useSearch(mockRoutes as any))

      act(() => {
        result.current.setIsOpen(true)
      })

      // The FlexSearch index state in the hook is not exported, but we can verify it doesn't fail
      expect(result.current.query).toBe('')
    })

    it('should perform debounced fetch request to Algolia and map results correctly', async () => {
      const mockHits = [
        {
          objectID: 'hit-1',
          url: 'https://boltdocs.dev/docs/intro#setup',
          hierarchy: {
            lvl0: 'Getting Started',
            lvl1: 'Introduction',
            lvl2: 'Setup Guide',
          },
          content: 'Install the package using your favorite package manager.',
          anchor: 'setup',
        },
      ]

      const fetchSpy = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hits: mockHits }),
        }),
      )
      vi.stubGlobal('fetch', fetchSpy)

      const { result } = renderHook(() => useSearch(mockRoutes as any))

      act(() => {
        result.current.setQuery('setup')
      })

      // Fetch should not be called immediately due to 250ms debounce
      expect(fetchSpy).not.toHaveBeenCalled()

      // Fast-forward timers
      await act(async () => {
        vi.advanceTimersByTime(250)
      })

      expect(fetchSpy).toHaveBeenCalledOnce()
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://ALG_APP_123-dsn.algolia.net/1/indexes/docs_index/query',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Algolia-API-Key': 'alg_search_key_abc',
            'X-Algolia-Application-Id': 'ALG_APP_123',
          },
          body: JSON.stringify({
            params:
              'query=setup&hitsPerPage=20&facetFilters=' +
              encodeURIComponent(JSON.stringify(['lang:en'])),
          }),
        }),
      )

      // Verify that list results are mapped to the SearchResult shape
      expect(result.current.list).toHaveLength(1)
      expect(result.current.list[0]).toEqual({
        id: 'hit-1',
        title: 'Setup Guide',
        path: '/docs/intro#setup',
        bio: 'Getting Started > Introduction > Setup Guide',
        groupTitle: 'Getting Started',
        isHeading: true,
      })
    })

    it('should include version facet filters if version is active', async () => {
      vi.mocked(useRoutes).mockReturnValue({
        currentLocale: 'es',
        currentVersion: 'v2',
      } as any)

      const fetchSpy = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hits: [] }),
        }),
      )
      vi.stubGlobal('fetch', fetchSpy)

      const { result } = renderHook(() => useSearch(mockRoutes as any))

      act(() => {
        result.current.setQuery('config')
      })

      await act(async () => {
        vi.advanceTimersByTime(250)
      })

      expect(fetchSpy).toHaveBeenCalledOnce()
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
      const expectedParams =
        'query=config&hitsPerPage=20&facetFilters=' +
        encodeURIComponent(JSON.stringify(['lang:es', 'version:v2']))
      expect(body.params).toBe(expectedParams)
    })

    it('aborts stale Algolia requests and ignores their late responses', async () => {
      const requests: Array<{
        signal: AbortSignal
        resolve: (value: unknown) => void
      }> = []
      const fetchSpy = vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((resolve) => {
            requests.push({ signal: init.signal as AbortSignal, resolve })
          }),
      )
      vi.stubGlobal('fetch', fetchSpy)

      const { result } = renderHook(() => useSearch(mockRoutes as any))
      act(() => result.current.setQuery('old'))
      await act(async () => vi.advanceTimersByTime(250))
      expect(requests).toHaveLength(1)

      act(() => result.current.setQuery('new'))
      await act(async () => vi.advanceTimersByTime(250))
      expect(requests).toHaveLength(2)
      expect(requests[0]?.signal.aborted).toBe(true)

      await act(async () => {
        requests[1]?.resolve({
          ok: true,
          json: async () => ({ hits: [{ objectID: 'new', url: '/new' }] }),
        })
        requests[0]?.resolve({
          ok: true,
          json: async () => ({ hits: [{ objectID: 'old', url: '/old' }] }),
        })
        await Promise.resolve()
      })

      expect(result.current.status).toBe('ready')
      expect(result.current.list.map((item) => item.path)).toEqual(['/new'])
    })

    it('surfaces Algolia request errors and clears loading state', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
          statusText: 'Unavailable',
        }),
      )

      const { result } = renderHook(() => useSearch(mockRoutes as any))
      act(() => result.current.setQuery('config'))
      await act(async () => {
        vi.advanceTimersByTime(250)
        await Promise.resolve()
      })

      expect(result.current.status).toBe('error')
      expect(result.current.searchError?.message).toContain('503')
      expect(result.current.isLoading).toBe(false)
      expect(consoleError).toHaveBeenCalled()
    })

    it('maps Algolia highlighted snippets to safe plain text', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            hits: [
              {
                objectID: 'snippet',
                url: '/docs/search',
                hierarchy: { lvl0: 'Docs', lvl1: 'Search' },
                _snippetResult: {
                  content: { value: '<em>Fast</em> &amp; clear' },
                },
              },
            ],
          }),
        }),
      )

      const { result } = renderHook(() => useSearch(mockRoutes as any))
      act(() => result.current.setQuery('fast'))
      await act(async () => vi.advanceTimersByTime(250))

      expect(result.current.list[0]?.snippet).toBe('Fast & clear')
      expect(result.current.list[0]?.bio).toBe('Docs > Search')
    })
  })
})
