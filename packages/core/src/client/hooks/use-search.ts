import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Index } from 'flexsearch'
import { useRoutes } from './use-routes'
import { useConfig } from '../app/config-context'
import type { ComponentRoute } from '../types'
import { useNavigate } from '../router'
import fetchSearchData from 'virtual:boltdocs-search'

interface SearchDataItem {
  id: string
  title: string
  content: string
  url: string
  display: string
  locale?: string
  version?: string
}

interface AlgoliaHit {
  objectID?: string
  url?: string
  hierarchy?: Record<string, string | undefined>
  anchor?: string
}

interface SearchResult {
  id: string
  title: string
  path: string
  bio: string
  groupTitle: string
  isHeading: boolean
  localeMatch?: boolean
}

export function useSearch(routes: ComponentRoute[]) {
  const { currentLocale, currentVersion } = useRoutes()
  const config = useConfig()
  const algoliaConfig = config.integrations?.search?.algolia

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<Index | null>(null)
  const [algoliaResults, setAlgoliaResults] = useState<SearchResult[]>([])
  const [searchData, setSearchData] = useState<SearchDataItem[]>([])
  const [searchDataLoading, setSearchDataLoading] = useState(false)
  const [searchDataError, setSearchDataError] = useState<Error | null>(null)
  const searchGeneration = useRef(0)
  const loadingGeneration = useRef<number | null>(null)
  const navigate = useNavigate()

  // Fetch the search index lazily when the dialog opens and we are not
  // using Algolia. Keeping the index out of the JS bundle significantly
  // reduces initial bundle size and build time.
  useEffect(() => {
    if (algoliaConfig || !isOpen) return

    // Use cached data if already loaded.
    if (searchData.length > 0) return

    setSearchDataLoading(true)
    setSearchDataError(null)
    let active = true
    const generation = ++searchGeneration.current
    loadingGeneration.current = generation

    fetchSearchData()
      .then((data: SearchDataItem[]) => {
        if (!active || generation !== searchGeneration.current) return
        setSearchData(data || [])
        if (loadingGeneration.current === generation) {
          loadingGeneration.current = null
          setSearchDataLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!active || generation !== searchGeneration.current) return
        console.error('[boltdocs] Failed to load search index:', err)
        setSearchDataError(err)
        if (loadingGeneration.current === generation) {
          loadingGeneration.current = null
          setSearchDataLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [isOpen, algoliaConfig, searchData.length])

  useEffect(() => {
    if (!import.meta.hot) return

    const applyFrontmatterDelta = (payload: {
      search?: { updated?: SearchDataItem[]; deleted?: string[] }
    }) => {
      const updated = payload.search?.updated ?? []
      const deleted = new Set(payload.search?.deleted ?? [])
      searchGeneration.current += 1
      if (loadingGeneration.current !== null) {
        loadingGeneration.current = null
        setSearchDataLoading(false)
      }
      setSearchData((prev) => {
        const map = new Map(prev.map((d) => [d.id, d]))
        for (const doc of updated) {
          map.set(doc.id, doc)
        }
        for (const id of deleted) {
          map.delete(id)
        }
        return Array.from(map.values())
      })
      setIndex(null)
    }

    const refreshFromAsset = async () => {
      const generation = ++searchGeneration.current
      loadingGeneration.current = generation
      setSearchDataLoading(true)
      try {
        const data = await fetchSearchData({ bustCache: true })
        if (generation !== searchGeneration.current) return
        setSearchData(data || [])
        setSearchDataError(null)
        setIndex(null)
      } catch (error) {
        if (generation !== searchGeneration.current) return
        console.error('[boltdocs] Failed to refresh search index:', error)
        setSearchDataError(
          error instanceof Error ? error : new Error(String(error)),
        )
      } finally {
        if (generation === searchGeneration.current) {
          loadingGeneration.current = null
          setSearchDataLoading(false)
        }
      }
    }

    const hot = import.meta.hot
    hot.on('boltdocs:frontmatter-update', applyFrontmatterDelta)
    hot.on('boltdocs:mdx-update', refreshFromAsset)
    return () => {
      hot.off?.('boltdocs:frontmatter-update', applyFrontmatterDelta)
      hot.off?.('boltdocs:mdx-update', refreshFromAsset)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = /Mac/.test(navigator.userAgent)
      const isMeta = isMac ? e.metaKey : e.ctrlKey

      if (isMeta && (e.key === 'k' || e.key === 'j')) {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelect = useCallback(
    (key: React.Key) => {
      const path = String(key)
      if (!path) return

      setIsOpen(false)
      const url = new URL(path, window.location.origin)
      if (query) {
        url.searchParams.set('hl', query)
      }

      const finalPath = `${url.pathname}${url.search}${url.hash}`
      navigate(finalPath)
    },
    [navigate, query],
  )

  // Initialize FlexSearch index once search data has been loaded
  // (only if Algolia is NOT configured).
  useEffect(() => {
    if (algoliaConfig) return
    if (!isOpen || searchData.length === 0 || index) return

    const newIndex = new Index({
      tokenize: 'forward',
      cache: true,
    })

    // FlexSearch's basic Index requires numeric document IDs. Keep the
    // numeric position as the index key and resolve it back to searchData
    // after searching; route IDs remain string URLs in the public result.
    for (let i = 0; i < searchData.length; i++) {
      const doc = searchData[i]
      if (!doc) continue
      newIndex.add(i, `${doc.title} ${doc.content}`)
    }

    setIndex(newIndex)
  }, [isOpen, index, algoliaConfig, searchData])

  // Asynchronous Algolia search effect with debounce
  useEffect(() => {
    if (!algoliaConfig) return
    if (!query) {
      setAlgoliaResults([])
      return
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const url = `https://${algoliaConfig.appId}-dsn.algolia.net/1/indexes/${algoliaConfig.indexName}/query`

        // Build facet filters dynamically if locale or version are active
        const facetFilters: string[] = []
        if (currentLocale) {
          facetFilters.push(`lang:${currentLocale}`)
        }
        if (currentVersion) {
          facetFilters.push(`version:${currentVersion}`)
        }

        let params = `query=${encodeURIComponent(query)}&hitsPerPage=20`
        if (facetFilters.length > 0) {
          params += `&facetFilters=${encodeURIComponent(JSON.stringify(facetFilters))}`
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Algolia-API-Key': algoliaConfig.apiKey,
            'X-Algolia-Application-Id': algoliaConfig.appId,
          },
          body: JSON.stringify({ params }),
        })

        if (!response.ok) {
          throw new Error(
            `Algolia search request failed: ${response.statusText}`,
          )
        }

        const data = await response.json()
        const hits = data.hits || []

        const results: SearchResult[] = hits.map((hit: AlgoliaHit) => {
          let path = hit.url || ''
          try {
            if (path.startsWith('http://') || path.startsWith('https://')) {
              const urlObj = new URL(path)
              path = urlObj.pathname + urlObj.search + urlObj.hash
            }
          } catch {
            // Keep hit.url as fallback
          }

          const hierarchy = hit.hierarchy || {}
          const levels = [
            hierarchy.lvl0,
            hierarchy.lvl1,
            hierarchy.lvl2,
            hierarchy.lvl3,
            hierarchy.lvl4,
            hierarchy.lvl5,
            hierarchy.lvl6,
          ].filter(Boolean) as string[]

          const title = levels[levels.length - 1] || 'Documentation'
          const bio = levels.join(' > ')

          return {
            id: hit.objectID || path,
            title: title,
            path: path,
            bio: bio,
            groupTitle: hierarchy.lvl0 || 'Docs',
            isHeading: !!hit.anchor || path.includes('#'),
          }
        })

        setAlgoliaResults(results)
      } catch (err) {
        console.error('Error fetching search results from Algolia:', err)
      }
    }, 250)

    return () => clearTimeout(delayDebounceFn)
  }, [query, algoliaConfig, currentLocale, currentVersion])

  const list = useMemo(() => {
    if (!query) {
      // Default results: just active routes
      return routes
        .filter((r) => {
          const routeLocale = r.locale || config.i18n?.defaultLocale
          const routeVersion = r.version || config.versions?.defaultVersion
          const localeMatch = !currentLocale || routeLocale === currentLocale
          const versionMatch =
            !currentVersion || routeVersion === currentVersion
          return localeMatch && versionMatch
        })
        .slice(0, 10)
        .map((r) => ({
          id: r.path,
          title: r.title,
          path: r.path,
          bio: r.description || '',
          groupTitle: r.groupTitle,
        }))
    }

    if (algoliaConfig) {
      return algoliaResults
    }

    if (!index) return []

    const searchResults = index.search(query, {
      limit: 20,
      suggest: true,
    })

    const results: SearchResult[] = []
    const seen = new Set<string>()

    for (const id of searchResults) {
      const numericId = typeof id === 'number' ? id : Number(id)
      const doc = searchData[numericId]
      if (!doc) continue

      const docLocale = doc.locale || config.i18n?.defaultLocale
      const docVersion = doc.version || config.versions?.defaultVersion
      const localeMatch =
        !currentLocale ||
        docLocale === currentLocale ||
        (!doc.locale && currentLocale === config.i18n?.defaultLocale)
      const versionMatch = !currentVersion || docVersion === currentVersion
      if (!versionMatch) continue

      if (seen.has(doc.url)) continue
      seen.add(doc.url)

      results.push({
        id: doc.url,
        title: doc.title,
        path: doc.url,
        bio: doc.display,
        groupTitle: doc.display.split(' > ')[0],
        isHeading: doc.url.includes('#'),
        localeMatch,
      })
    }

    return results.filter((result) => result.localeMatch).slice(0, 10)
  }, [
    query,
    index,
    currentLocale,
    currentVersion,
    routes,
    searchData,
    algoliaConfig,
    algoliaResults,
    config,
  ])

  return {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    list,
    searchDataLoading,
    searchDataError,
    handleSelect,
    input: {
      value: query,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setQuery(e.target.value),
    },
  }
}
