import { useMemo } from 'react'
import { useConfig } from '../app/config-context'
import { useCollectionsData, useCurrentPostData } from './collections-context'
import { useRoutes } from '../hooks/use-routes'
import type { CollectionPost } from './collections-context'

const DEFAULT_COLLECTION = 'blog'

interface UsePostsOptions {
  includeDrafts?: boolean
}

/**
 * Returns the posts of a collection, filtered by the current locale and version.
 * Defaults to "blog" if no collection is specified.
 * @param collection - The name of the collection. Defaults to "blog".
 * @param options - Options to customize the query.
 * @param options.includeDrafts - If true, includes draft posts in the results.
 * @returns The filtered posts of the collection.
 */
export function usePosts(
  collection: string = DEFAULT_COLLECTION,
  options?: UsePostsOptions,
): CollectionPost[] {
  const data = useCollectionsData()
  const { currentLocale, currentVersion } = useRoutes()
  const config = useConfig()

  const posts = data[collection] || []
  const defaultLocale = config.i18n?.defaultLocale
  const defaultVersion = config.versions?.defaultVersion

  return useMemo(() => {
    return posts.filter((post) => {
      const postLocale = post.locale || defaultLocale
      const postVersion = post.version || defaultVersion
      const localeMatch = !currentLocale || postLocale === currentLocale
      const versionMatch = !currentVersion || postVersion === currentVersion
      const draftMatch = options?.includeDrafts || !post.draft
      return localeMatch && versionMatch && draftMatch
    })
  }, [
    posts,
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
      () => ({
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
 * Returns the recent posts of a collection. Defaults to "blog".
 * @param collection - The name of the collection. Defaults to "blog".
 * @param count - The number of recent posts to return.
 * @returns The recent posts of the collection.
 */
export function useRecentPosts(
  collection: string = DEFAULT_COLLECTION,
  count: number = 5,
): CollectionPost[] {
  const posts = usePosts(collection)
  return useMemo(() => posts.slice(0, count), [posts, count])
}
