import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Index } from 'flexsearch'
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
  content?: string
  _snippetResult?: {
    content?: { value?: string }
  }
}

export interface SearchResult {
  id: string
  title: string
  path: string
  bio: string
  groupTitle: string
  isHeading: boolean
  localeMatch?: boolean
  /** Optional Algolia-provided plain-text excerpt. */
  snippet?: string
}

export type SearchStatus =
  | 'idle'
  | 'loading'
  | 'indexing'
  | 'ready'
  | 'searching'
  | 'error'

export interface SearchHotContext {
  on: (event: string, callback: (payload?: unknown) => void) => void
  off?: (event: string, callback: (payload?: unknown) => void) => void
}

const SEARCH_DEBOUNCE_MS = 250
const SEARCH_RESULT_LIMIT = 10

function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
}

function decodeAlgoliaSnippet(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/\s+/g, ' ')
    .trim()
}

function createSearchSnippet(content: string, query: string): string {
  const normalizedContent = content.replace(/\s+/g, ' ').trim()
  if (!normalizedContent) return ''
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => term.toLocaleLowerCase())
  const lowerContent = normalizedContent.toLocaleLowerCase()
  const matchIndexes = terms
    .map((term) => lowerContent.indexOf(term))
    .filter((index) => index >= 0)
  const firstMatch = matchIndexes.length > 0 ? Math.min(...matchIndexes) : 0
  const start = Math.max(0, firstMatch - 48)
  const end = Math.min(normalizedContent.length, firstMatch + 152)
  return `${start > 0 ? '…' : ''}${normalizedContent.slice(start, end)}${
    end < normalizedContent.length ? '…' : ''
  }`
}

function getLocalRelevance(doc: SearchDataItem, query: string): number {
  const normalizedQuery = foldSearchText(query.trim())
  const terms = normalizedQuery.split(/\s+/).filter(Boolean)
  if (terms.length === 0) return 0

  const title = foldSearchText(doc.title)
  const display = foldSearchText(doc.display)
  const content = foldSearchText(doc.content)
  const combined = `${title} ${display} ${content}`
  if (!terms.every((term) => combined.includes(term))) return -1

  let score = terms.length
  if (title === normalizedQuery) score += 120
  else if (title.startsWith(normalizedQuery)) score += 80
  else if (title.includes(normalizedQuery)) score += 60
  else if (display.includes(normalizedQuery)) score += 35

  for (const term of terms) {
    if (title.startsWith(term)) score += 24
    else if (title.includes(term)) score += 16
    if (content.includes(term)) score += 6
  }
  return score
}

/** Apply a frontmatter HMR delta in one immutable update. */
export function applySearchDelta(
  documents: SearchDataItem[],
  delta: {
    updated?: SearchDataItem[]
    deleted?: string[]
  },
): SearchDataItem[] {
  const next = new Map(documents.map((document) => [document.id, document]))
  for (const document of delta.updated ?? []) next.set(document.id, document)
  for (const id of delta.deleted ?? []) next.delete(id)
  return [...next.values()]
}

export function useSearch(
  routes: ComponentRoute[],
  options: { hot?: SearchHotContext } = {},
) {
  const { currentLocale, currentVersion } = useRoutes()
  const config = useConfig()
  const algoliaConfig = config.integrations?.search?.algolia

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<Index | null>(null)
  const [algoliaResults, setAlgoliaResults] = useState<SearchResult[]>([])
  const [searchData, setSearchData] = useState<SearchDataItem[]>([])
  const [searchDataLoading, setSearchDataLoading] = useState(false)
  const [indexLoading, setIndexLoading] = useState(false)
  const [algoliaLoading, setAlgoliaLoading] = useState(false)
  const [searchDataError, setSearchDataError] = useState<Error | null>(null)
  const [algoliaError, setAlgoliaError] = useState<Error | null>(null)
  const searchGeneration = useRef(0)
  const loadingGeneration = useRef<number | null>(null)
  const algoliaGeneration = useRef(0)
  const algoliaController = useRef<AbortController | null>(null)
  const navigate = useNavigate()

  // Fetch the runtime search asset lazily. Algolia does not need the local
  // asset or FlexSearch at all.
  useEffect(() => {
    if (algoliaConfig || !isOpen || searchData.length > 0) return

    setSearchDataLoading(true)
    setIndexLoading(false)
    setSearchDataError(null)
    const generation = ++searchGeneration.current
    loadingGeneration.current = generation

    fetchSearchData()
      .then((data: SearchDataItem[]) => {
        if (generation !== searchGeneration.current) return
        const next = Array.isArray(data) ? data : []
        setSearchData(next)
        setSearchDataError(null)
        setIndex(null)
      })
      .catch((error: unknown) => {
        if (generation !== searchGeneration.current) return
        const normalized =
          error instanceof Error ? error : new Error(String(error))
        console.error('[boltdocs] Failed to load search index:', normalized)
        setSearchDataError(normalized)
        setIndex(null)
      })
      .finally(() => {
        if (generation !== searchGeneration.current) return
        loadingGeneration.current = null
        setSearchDataLoading(false)
      })

    return () => {
      // Incrementing the generation prevents a late promise from publishing
      // after close, an HMR refresh, or component unmount.
      if (loadingGeneration.current === generation) {
        searchGeneration.current += 1
        loadingGeneration.current = null
      }
    }
  }, [isOpen, algoliaConfig, searchData.length])

  // Frontmatter updates carry a precise delta. Body-only updates reload the
  // runtime asset; all paths are generation guarded before touching state.
  useEffect(() => {
    const hot = (options.hot ?? import.meta.hot) as SearchHotContext | undefined
    if (!hot) return

    const applyFrontmatterDelta = (payload: unknown) => {
      const delta = payload as {
        search?: { updated?: SearchDataItem[]; deleted?: string[] }
      }
      searchGeneration.current += 1
      if (loadingGeneration.current !== null) {
        loadingGeneration.current = null
        setSearchDataLoading(false)
      }
      setSearchData((previous) =>
        applySearchDelta(previous, delta.search ?? {}),
      )
      setSearchDataError(null)
      setIndex(null)
    }

    const refreshFromAsset = () => {
      const generation = ++searchGeneration.current
      loadingGeneration.current = generation
      setSearchDataLoading(true)
      setSearchDataError(null)
      void fetchSearchData({ bustCache: true })
        .then((data: SearchDataItem[]) => {
          if (generation !== searchGeneration.current) return
          setSearchData(Array.isArray(data) ? data : [])
          setIndex(null)
        })
        .catch((error: unknown) => {
          if (generation !== searchGeneration.current) return
          const normalized =
            error instanceof Error ? error : new Error(String(error))
          console.error(
            '[boltdocs] Failed to refresh search index:',
            normalized,
          )
          setSearchDataError(normalized)
        })
        .finally(() => {
          if (generation !== searchGeneration.current) return
          loadingGeneration.current = null
          setSearchDataLoading(false)
        })
    }

    hot.on('boltdocs:frontmatter-update', applyFrontmatterDelta)
    hot.on('boltdocs:mdx-update', refreshFromAsset)
    return () => {
      searchGeneration.current += 1
      hot.off?.('boltdocs:frontmatter-update', applyFrontmatterDelta)
      hot.off?.('boltdocs:mdx-update', refreshFromAsset)
    }
  }, [options.hot])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
      const shortcutKey = isMac ? event.metaKey : event.ctrlKey
      if (
        shortcutKey &&
        (event.key === 'k' ||
          event.key === 'K' ||
          event.key === 'j' ||
          event.key === 'J')
      ) {
        event.preventDefault()
        setIsOpen((previous) => !previous)
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
      if (query.trim()) url.searchParams.set('hl', query.trim())
      navigate(`${url.pathname}${url.search}${url.hash}`)
    },
    [navigate, query],
  )

  // Build the local index only after the runtime asset has loaded.
  useEffect(() => {
    if (algoliaConfig || !isOpen || searchData.length === 0 || index) return

    let cancelled = false
    const generation = searchGeneration.current
    setIndexLoading(true)
    setSearchDataError(null)
    void import('flexsearch')
      .then(({ Index: FlexIndex }) => {
        if (cancelled || generation !== searchGeneration.current) return
        const nextIndex = new FlexIndex({ tokenize: 'forward', cache: true })
        searchData.forEach((document, id) => {
          nextIndex.add(id, `${document.title} ${document.content}`)
        })
        setIndex(nextIndex)
      })
      .catch((error: unknown) => {
        if (cancelled || generation !== searchGeneration.current) return
        const normalized =
          error instanceof Error ? error : new Error(String(error))
        console.error('[boltdocs] Failed to load search engine:', normalized)
        setSearchDataError(normalized)
      })
      .finally(() => {
        if (cancelled || generation !== searchGeneration.current) return
        setIndexLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, index, algoliaConfig, searchData])

  // Algolia requests are debounced, abortable, and generation guarded. This
  // covers slow networks and a newer query arriving after fetch dispatch.
  useEffect(() => {
    const normalizedQuery = query.trim()
    if (!algoliaConfig) return

    if (!normalizedQuery) {
      algoliaGeneration.current += 1
      algoliaController.current?.abort()
      algoliaController.current = null
      setAlgoliaResults([])
      setAlgoliaError(null)
      setAlgoliaLoading(false)
      return
    }

    const generation = ++algoliaGeneration.current
    algoliaController.current?.abort()
    const controller = new AbortController()
    algoliaController.current = controller
    setAlgoliaError(null)
    setAlgoliaLoading(true)

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const facetFilters: string[] = []
          if (currentLocale) facetFilters.push(`lang:${currentLocale}`)
          if (currentVersion) facetFilters.push(`version:${currentVersion}`)

          const url = `https://${algoliaConfig.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(algoliaConfig.indexName)}/query`
          const params = new URLSearchParams({
            query: normalizedQuery,
            hitsPerPage: '20',
          })
          if (facetFilters.length > 0) {
            params.set('facetFilters', JSON.stringify(facetFilters))
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Algolia-API-Key': algoliaConfig.apiKey,
              'X-Algolia-Application-Id': algoliaConfig.appId,
            },
            body: JSON.stringify({ params: params.toString() }),
            signal: controller.signal,
          })
          if (!response.ok) {
            throw new Error(
              `Algolia search request failed: ${response.status} ${response.statusText}`.trim(),
            )
          }

          const data = (await response.json()) as { hits?: unknown }
          if (
            generation !== algoliaGeneration.current ||
            controller.signal.aborted
          ) {
            return
          }
          const hits = Array.isArray(data.hits)
            ? (data.hits as AlgoliaHit[])
            : []
          const results = hits
            .map((hit): SearchResult | null => {
              let path = hit.url || ''
              try {
                if (/^https?:\/\//.test(path)) {
                  const urlObject = new URL(path)
                  path = `${urlObject.pathname}${urlObject.search}${urlObject.hash}`
                }
              } catch {
                // Keep a non-standard hit URL as-is.
              }

              const hierarchy = hit.hierarchy ?? {}
              const levels = [
                hierarchy.lvl0,
                hierarchy.lvl1,
                hierarchy.lvl2,
                hierarchy.lvl3,
                hierarchy.lvl4,
                hierarchy.lvl5,
                hierarchy.lvl6,
              ].filter((value): value is string => Boolean(value))
              if (!path) return null

              const title =
                levels.at(-1) ?? hit.content?.slice(0, 120) ?? 'Documentation'
              const rawSnippet = hit._snippetResult?.content?.value
              const snippet = rawSnippet
                ? decodeAlgoliaSnippet(rawSnippet)
                : undefined
              return {
                id: hit.objectID || path,
                title,
                path,
                bio: levels.join(' > '),
                groupTitle: hierarchy.lvl0 ?? 'Docs',
                isHeading: Boolean(hit.anchor) || path.includes('#'),
                ...(snippet ? { snippet } : {}),
              }
            })
            .filter((result): result is SearchResult => result !== null)

          setAlgoliaResults(results)
        } catch (error) {
          if (
            controller.signal.aborted ||
            generation !== algoliaGeneration.current ||
            (error instanceof DOMException && error.name === 'AbortError')
          ) {
            return
          }
          const normalized =
            error instanceof Error ? error : new Error(String(error))
          console.error('[boltdocs] Algolia search failed:', normalized)
          setAlgoliaError(normalized)
          setAlgoliaResults([])
        } finally {
          if (generation === algoliaGeneration.current) {
            setAlgoliaLoading(false)
            if (algoliaController.current === controller) {
              algoliaController.current = null
            }
          }
        }
      })()
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
      if (algoliaController.current === controller)
        algoliaController.current = null
      if (generation === algoliaGeneration.current) {
        algoliaGeneration.current += 1
        setAlgoliaLoading(false)
      }
    }
  }, [query, algoliaConfig, currentLocale, currentVersion])

  const list = useMemo(() => {
    if (!query.trim()) {
      return routes
        .filter((route) => {
          const routeLocale = route.locale || config.i18n?.defaultLocale
          const routeVersion = route.version || config.versions?.defaultVersion
          return (
            (!currentLocale || routeLocale === currentLocale) &&
            (!currentVersion || routeVersion === currentVersion)
          )
        })
        .slice(0, SEARCH_RESULT_LIMIT)
        .map((route) => ({
          id: route.path,
          title: route.title,
          path: route.path,
          bio: route.description || '',
          groupTitle: route.groupTitle,
        }))
    }

    if (algoliaConfig) return algoliaResults
    if (!index || indexLoading) return []

    const flexRank = new Map<number, number>()
    try {
      const candidates = index.search(query.trim(), {
        limit: searchData.length,
        suggest: true,
      })
      candidates.forEach((id, rank) => {
        const numericId = typeof id === 'number' ? id : Number(id)
        if (Number.isInteger(numericId)) flexRank.set(numericId, rank)
      })
    } catch (error) {
      console.error('[boltdocs] Local search failed:', error)
    }

    // Score every locale/version-eligible document before deduplication and
    // limiting. This prevents a large excluded locale from consuming the
    // engine's candidate limit, and supplies accent-insensitive fallback hits.
    const ranked = searchData
      .map((document, id) => {
        const documentLocale = document.locale || config.i18n?.defaultLocale
        const documentVersion =
          document.version || config.versions?.defaultVersion
        if (currentLocale && documentLocale !== currentLocale) return null
        if (currentVersion && documentVersion !== currentVersion) return null

        const relevance = getLocalRelevance(document, query)
        if (relevance < 0) return null
        return {
          document,
          score: relevance * 1_000 - (flexRank.get(id) ?? searchData.length),
        }
      })
      .filter(
        (result): result is { document: SearchDataItem; score: number } =>
          result !== null,
      )
      .sort((left, right) => right.score - left.score)

    const results: SearchResult[] = []
    const seen = new Set<string>()
    for (const { document } of ranked) {
      if (seen.has(document.url)) continue
      seen.add(document.url)
      results.push({
        id: document.url,
        title: document.title,
        path: document.url,
        bio: document.display,
        groupTitle: document.display.split(' > ')[0],
        isHeading: document.url.includes('#'),
        localeMatch: true,
        snippet: createSearchSnippet(document.content, query),
      })
      if (results.length === SEARCH_RESULT_LIMIT) break
    }
    return results
  }, [
    query,
    index,
    indexLoading,
    currentLocale,
    currentVersion,
    routes,
    searchData,
    algoliaConfig,
    algoliaResults,
    config,
  ])

  const error = algoliaConfig ? algoliaError : searchDataError
  const status: SearchStatus = error
    ? 'error'
    : algoliaConfig
      ? algoliaLoading
        ? 'searching'
        : query.trim()
          ? 'ready'
          : 'idle'
      : searchDataLoading
        ? 'loading'
        : isOpen && searchData.length > 0 && indexLoading
          ? 'indexing'
          : isOpen && searchData.length > 0 && !index
            ? 'indexing'
            : isOpen
              ? 'ready'
              : 'idle'

  return {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    list,
    status,
    isLoading:
      status === 'loading' || status === 'indexing' || status === 'searching',
    isIndexing: status === 'indexing',
    error,
    searchDataLoading,
    searchDataError,
    searchError: algoliaError,
    handleSelect,
    input: {
      value: query,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setQuery(event.target.value),
    },
  }
}
