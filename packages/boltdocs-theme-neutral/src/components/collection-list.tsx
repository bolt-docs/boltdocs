import {
  formatDeterministicDate,
  useConfig,
  useLoaderData,
  useLocation,
  usePosts,
} from '@bdocs/runtime'
import { Link } from './composition/link'

/**
 * The index a collection renders when the site did not write a `list.tsx` for
 * it.
 *
 * Pagination is derived from the loader data the route supplied; the post list
 * falls back to the collection data in context, so the first client render (no
 * loader data yet) already has the posts.
 */
export function CollectionList() {
  const location = useLocation()
  const config = useConfig()
  const loaderData = useLoaderData() as
    | {
        posts?: any[]
        totalPages?: number
        currentPage?: number
        collection?: string
      }
    | undefined

  const postsPerPage =
    (config.collections as { postsPerPage?: number } | undefined)
      ?.postsPerPage ?? 10

  // Derive base path by stripping any trailing /page/N segment. This works
  // regardless of custom base paths, locales, or nested prefixes.
  const basePath = location.pathname
    .replace(/\/page\/\d+\/?$/, '')
    .replace(/\/$/, '')
  const segments = basePath.split('/').filter(Boolean)
  const collection = loaderData?.collection || segments[segments.length - 1]

  const allPosts = usePosts(collection)
  const totalPages =
    loaderData?.totalPages || Math.ceil(allPosts.length / postsPerPage)
  const currentPage =
    loaderData?.currentPage ||
    (() => {
      const match = location.pathname.match(/\/page\/(\d+)\/?$/)
      return match ? Number(match[1]) : 1
    })()

  const start = (currentPage - 1) * postsPerPage
  const posts = loaderData?.posts || allPosts.slice(start, start + postsPerPage)

  if (!posts.length) return null

  return (
    <div className="bdocs-collection">
      <h1 className="bdocs-collection__title">{collection}</h1>
      <div className="bdocs-collection__posts">
        {posts.map((post) => (
          <article key={post.path} className="bdocs-collection__post">
            <h2 className="bdocs-collection__post-title">
              <Link to={post.path} className="bdocs-collection__link">
                {post.title}
              </Link>
            </h2>
            {post.date && (
              <time className="bdocs-collection__date">
                {/* Pinned locale and zone: an ambient default makes the
                    server and browser render different text and React discards
                    the server HTML. */}
                {formatDeterministicDate(post.date, { month: 'short' })}
              </time>
            )}
            {post.excerpt && (
              <p className="bdocs-collection__excerpt">{post.excerpt}</p>
            )}
          </article>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="bdocs-collection__pagination">
          {currentPage > 1 && (
            <Link
              to={
                currentPage === 2
                  ? basePath
                  : `${basePath}/page/${currentPage - 1}`
              }
              className="bdocs-collection__link"
            >
              Previous
            </Link>
          )}
          <span className="bdocs-collection__pages">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              to={`${basePath}/page/${currentPage + 1}`}
              className="bdocs-collection__link"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
