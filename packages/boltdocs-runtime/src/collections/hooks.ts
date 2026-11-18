import { useCallback, useMemo } from 'react'
import { compareCollections } from '@bdocs/contracts'
import { useConfig } from '../config-context'
import { useCollectionsData, useCurrentPostData } from './collections-context'
import { useRoutes } from '../hooks/use-routes'
import { useLoaderData } from '../router'
import type { CollectionPost } from './collections-context'
import { formatCollectionDate } from './utils'

const DEFAULT_COLLECTION = 'blog'

interface UsePostsOptions {
  includeDrafts?: boolean
}

/**
 * Returns the posts of a collection, filtered by the current locale and version.
 * Defaults to `collections.defaultCollection` ("blog" when unset).
 * @param collection - The collection name; falls back to the configured default.
 * @param options - Options to customize the query.
 * @param options.includeDrafts - If true, includes draft posts in the results.
 * @returns The filtered posts of the collection.
 */
export function usePosts(
  collection?: string,
  options?: UsePostsOptions,
): CollectionPost[] {
  const data = useCollectionsData()
  const { currentLocale, currentVersion } = useRoutes()
  const config = useConfig()

  const name =
    collection ?? config.collections?.defaultCollection ?? DEFAULT_COLLECTION
  const posts = data[name] || []
  const defaultLocale = config.i18n?.defaultLocale
  const defaultVersion = config.versions?.defaultVersion
  const sortBy = config.collections?.sortBy

  return useMemo(() => {
    return posts
      .filter((post) => {
        const postLocale = post.locale || defaultLocale
        const postVersion = post.version || defaultVersion
        const localeMatch = !currentLocale || postLocale === currentLocale
        const versionMatch = !currentVersion || postVersion === currentVersion
        const draftMatch = options?.includeDrafts || !post.draft
        return localeMatch && versionMatch && draftMatch
      })
      .sort((a, b) => compareCollections(a, b, sortBy))
  }, [
    posts,
    sortBy,
    currentLocale,
    currentVersion,
    defaultLocale,
    defaultVersion,
    options?.includeDrafts,
  ])
}

/**
 * Returns a single post from a collection.
 *
 * @param collection - The name of the collection (optional inside post routes).
 * @param slug - The post slug (optional inside post routes).
 * @returns The matching post, or undefined if not found.
 */
export function usePost(): CollectionPost | undefined
export function usePost(
  collection: string,
  slug: string,
): CollectionPost | undefined
export function usePost(
  collection?: string,
  slug?: string,
): CollectionPost | undefined {
  const ctx = useCurrentPostData()
  const posts = usePosts(collection)

  if (ctx && !slug) {
    const { route } = ctx
    return useMemo(
      () =>
        ({
          path: route.path,
          title: route.title,
          date: route.date,
          excerpt: route.excerpt,
          tags: route.tags,
          author: route.author,
          coverImage: route.coverImage,
          filePath: route.filePath,
          locale: route.locale,
          version: route.version,
          frontmatter: route.frontmatter,
          lastUpdated: route.lastUpdated,
          contributors: route.contributors,
          headings: route.headings,
        }) as CollectionPost,
      [route],
    )
  }

  if (!collection || !slug) return undefined

  return useMemo(
    () =>
      posts.find(
        (p) =>
          p.path === `/${collection}/${slug}` ||
          p.path.endsWith(`/${slug}`) ||
          p.path === slug,
      ),
    [posts, collection, slug],
  )
}

/**
 * Returns the recent posts of a collection, using the configured default.
 * @param collection - The collection name; falls back to the configured default.
 * @param count - The number of recent posts to return.
 * @returns The recent posts of the collection.
 */
export function useRecentPosts(
  collection?: string,
  count: number = 5,
): CollectionPost[] {
  const posts = usePosts(collection)
  return useMemo(() => posts.slice(0, count), [posts, count])
}

/**
 * Returns the configured display label for a collection, falling back to its
 * id. Labels may be a plain string or a map keyed by locale.
 */
export function useCollectionLabel(collection: string): string {
  const config = useConfig()
  const { currentLocale } = useRoutes()
  const value = config.collections?.labels?.[collection]
  if (!value) return collection
  if (typeof value === 'string') return value
  return (
    value[currentLocale ?? ''] ??
    value[config.i18n?.defaultLocale ?? ''] ??
    collection
  )
}

/**
 * Returns the date formatter configured by `collections.dateFormat`.
 * Pinned to a fixed locale/zone so SSR and hydration agree.
 */
export function useCollectionDateFormatter(): (
  date: string | Date | undefined,
) => string {
  const format = useConfig().collections?.dateFormat
  return useCallback((date) => formatCollectionDate(date, format), [format])
}

export interface CollectionListState {
  posts: CollectionPost[]
  totalPages: number
  currentPage: number
  collection: string
  /** Canonical URL of the collection index, already localized and based. */
  basePath: string
  pageHref: (page: number) => string
}

/**
 * Everything a collection list needs to render, sourced from the route loader.
 *
 * Sorting, pagination and URL construction are decided by the runtime route
 * builder; a theme list only turns these values into markup. A `usePosts()`
 * fallback keeps a first client render useful before loader data arrives.
 */
export function useCollectionList(): CollectionListState {
  const data = useLoaderData<{
    posts?: CollectionPost[]
    totalPages?: number
    currentPage?: number
    collection?: string
    basePath?: string
  }>()
  const collection = data.collection ?? ''
  const fallbackPosts = usePosts(collection)
  const basePath = (data.basePath ?? '').replace(/\/+$/, '')

  return {
    posts: data.posts ?? fallbackPosts,
    totalPages: data.totalPages ?? 1,
    currentPage: data.currentPage ?? 1,
    collection,
    basePath,
    pageHref: (page) => (page <= 1 ? basePath : `${basePath}/page/${page}`),
  }
}
