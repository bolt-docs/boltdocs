import { useMemo } from 'react'
import { useCollectionsData } from './collections-context'
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
  return data[collection] || []
}

/**
 * Returns a post by its slug.
 * @param collection - The name of the collection.
 * @param slug - The slug of the post.
 * @returns The post with the given slug.
 */
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
