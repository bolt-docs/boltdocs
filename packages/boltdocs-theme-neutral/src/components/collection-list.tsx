import {
  useCollectionDateFormatter,
  useCollectionLabel,
  useCollectionList,
} from '@bdocs/runtime'
import { Link } from '@bdocs/ui-base/composition'

/**
 * The default collection index.
 *
 * Posts, pagination, URLs and date formatting all come from runtime hooks
 * backed by the route loader and `collections` config. This component only
 * renders them — no pathname parsing, sorting or slicing belongs in a theme.
 */
export function CollectionList() {
  const { posts, totalPages, currentPage, collection, pageHref } =
    useCollectionList()
  const formatDate = useCollectionDateFormatter()
  const label = useCollectionLabel(collection)

  if (!posts.length) return null

  return (
    <div className="bdocs-collection">
      <h1 className="bdocs-collection__title">{label}</h1>
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
                {formatDate(post.date)}
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
              to={pageHref(currentPage - 1)}
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
              to={pageHref(currentPage + 1)}
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
