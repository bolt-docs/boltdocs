import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSearch } from '../../src/client/hooks/use-search'
import { useConfig } from '../../src/client/app/config-context'
import { useRoutes } from '../../src/client/hooks/use-routes'

vi.mock('virtual:boltdocs-search', () => ({
  default: [
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
  ],
}))

vi.mock('../../src/client/app/config-context', () => ({
  useConfig: vi.fn(),
}))

vi.mock('../../src/client/hooks/use-routes', () => ({
  useRoutes: vi.fn(),
}))

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
    vi.useFakeTimers()
    vi.mocked(useRoutes).mockReturnValue({
      currentLocale: 'en',
      currentVersion: undefined,
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('FlexSearch (Fallback Mode)', () => {
    beforeEach(() => {
      vi.mocked(useConfig).mockReturnValue({})
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

    it('should perform local search using FlexSearch when query is populated', () => {
      const { result } = renderHook(() => useSearch(mockRoutes as any))

      // Trigger index creation
      act(() => {
        result.current.setIsOpen(true)
      })

      act(() => {
        result.current.setQuery('advanced')
      })

      expect(result.current.list).toHaveLength(1)
      expect(result.current.list[0]).toMatchObject({
        id: '/docs/advanced',
        title: 'Advanced Config',
        bio: 'Guides > Advanced Config',
      })
    })
  })

  describe('Algolia DocSearch Mode', () => {
    const algoliaConfig = {
      appId: 'ALG_APP_123',
      apiKey: 'alg_search_key_abc',
      indexName: 'docs_index',
    }

    beforeEach(() => {
      vi.mocked(useConfig).mockReturnValue({
        integrations: {
          algolia: algoliaConfig,
        },
      })
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
  })
})
