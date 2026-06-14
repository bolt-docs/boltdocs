import { useState, useMemo, useEffect } from 'react'
import { Index } from 'flexsearch'
import { useRoutes } from './use-routes'
import { useConfig } from '../app/config-context'
import type { ComponentRoute } from '../types'
// @ts-expect-error
import searchData from 'virtual:boltdocs-search'

interface SearchDataItem {
  id: string
  title: string
  content: string
  url: string
  display: string
  locale?: string
  version?: string
}

export function useSearch(routes: ComponentRoute[]) {
  const { currentLocale, currentVersion } = useRoutes()
  const config = useConfig()
  const algoliaConfig = config.integrations?.search?.algolia

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<Index | null>(null)
  const [algoliaResults, setAlgoliaResults] = useState<any[]>([])

  // Initialize FlexSearch index once (only if Algolia is NOT configured)
  useEffect(() => {
    if (algoliaConfig) return
    if (!isOpen || index) return

    const newIndex = new Index({
      preset: 'match',
      tokenize: 'full',
      resolution: 9,
      cache: true,
    })

    // Index all documents
    for (const doc of searchData as SearchDataItem[]) {
      newIndex.add(doc.id, `${doc.title} ${doc.content}`)
    }

    setIndex(newIndex)
  }, [isOpen, index, algoliaConfig])

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

        const results = hits.map((hit: any) => {
          let path = hit.url || ''
          try {
            if (path.startsWith('http://') || path.startsWith('https://')) {
              const urlObj = new URL(path)
              path = urlObj.pathname + urlObj.search + urlObj.hash
            }
          } catch (e) {
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

  // Pre-index searchData for O(1) lookups
  const searchDataMap = useMemo(() => {
    const map = new Map<string, SearchDataItem>()
    for (const doc of searchData as SearchDataItem[]) {
      map.set(doc.id, doc)
    }
    return map
  }, [])

  const list = useMemo(() => {
    if (!query) {
      // Default results: just active routes
      return routes
        .filter((r) => {
          const localeMatch = !currentLocale || r.locale === currentLocale
          const versionMatch = !currentVersion || r.version === currentVersion
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

    const results: any[] = []
    const seen = new Set<string>()

    for (const id of searchResults) {
      const doc = searchDataMap.get(id as string)
      if (!doc) continue

      // Filter by locale and version
      const localeMatch = !currentLocale || doc.locale === currentLocale
      const versionMatch = !currentVersion || doc.version === currentVersion
      if (!localeMatch || !versionMatch) continue

      if (seen.has(doc.url)) continue
      seen.add(doc.url)

      results.push({
        id: doc.url,
        title: doc.title,
        path: doc.url,
        bio: doc.display,
        groupTitle: doc.display.split(' > ')[0],
        isHeading: doc.url.includes('#'),
      })
    }

    return results.slice(0, 10)
  }, [
    query,
    index,
    currentLocale,
    currentVersion,
    routes,
    searchDataMap,
    algoliaConfig,
    algoliaResults,
  ])

  return {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    list,
    input: {
      value: query,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setQuery(e.target.value),
    },
  }
}
