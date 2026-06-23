import { useMemo } from 'react'
import { useConfig } from '../app/config-context'
import { useCollectionsData } from './collections-context'
import { useRoutes } from '../hooks/use-routes'
import type { CollectionPost } from './collections-context'

// useHeadings lives in hooks/use-headings — re-exported here for backwards compat
export { useHeadings } from '../hooks/use-headings'

/**
 * Returns the posts of a collection.
 * @param collection - The name of the collection.
 * @returns The posts of the collection.
 */
export function usePosts(collection: string): CollectionPost[] {
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
      return localeMatch && versionMatch
    })
  }, [posts, currentLocale, currentVersion, defaultLocale, defaultVersion])
}
export function usePost(
  collection: string,
  slug: string,
): CollectionPost | undefined {
  const posts = usePosts(collection)
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
 * Returns the recent posts of a collection.
 * @param collection - The name of the collection.
 * @param count - The number of recent posts to return.
 * @returns The recent posts of the collection.
 */
export function useRecentPosts(
  collection: string,
  count: number = 5,
): CollectionPost[] {
  const posts = usePosts(collection)
  return useMemo(() => posts.slice(0, count), [posts, count])
}
