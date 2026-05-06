import { useState, useMemo, useEffect } from 'react'
import { Index } from 'flexsearch'
import { useRoutes } from './use-routes'
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
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<Index | null>(null)

  // Initialize FlexSearch index once
  useEffect(() => {
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
  }, [isOpen, index])

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

    if (!index) return []

    const searchResults = index.search(query, {
      limit: 20,
      suggest: true,
    })

    const results: any[] = []
    const seen = new Set<string>()

    for (const id of searchResults) {
      const doc = (searchData as SearchDataItem[]).find((d) => d.id === id)
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
  }, [query, index, currentLocale, currentVersion, routes])

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
