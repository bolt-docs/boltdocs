import { useLoaderData, Link } from 'react-router-dom'
import { Pagination } from './pagination'
import { Tags } from './tags'
import { formatDate } from './utils'

type BlogLoaderData = {
  posts: Array<{
    path: string
    title: string
    date?: string | Date
    excerpt?: string
    tags?: string[]
    author?: string
    coverImage?: string
    filePath: string
  }>
  totalPages: number
  currentPage: number
}

export function BlogList() {
  const data = useLoaderData() as BlogLoaderData
  if (!data?.posts?.length) {
    return (
      <div className="text-center py-20 text-muted">
        <p className="text-lg">No posts yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {/* Blog header */}
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-body">Blog</h1>
        <p className="text-lg text-muted leading-relaxed">
          Thoughts, updates, and releases
        </p>
      </header>

      {/* Posts list — all items as link-style rows */}
      <div>
        {data.posts.map((post, i) => (
          <Link
            key={`${post.path}-${i}`}
            to={post.path}
            className="group block border-b border-subtle py-5 first:pt-0 last:border-b-0 last:pb-0 hover:bg-soft/40 -mx-4 sm:-mx-6 px-4 sm:px-6 rounded-lg transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6">
              {/* Date + author column */}
              <div className="shrink-0 text-left sm:text-right sm:min-w-[110px]">
                {post.date && (
                  <time className="block text-xs text-muted leading-snug">
                    {formatDate(post.date)}
                  </time>
                )}
                {post.author && (
                  <span className="block text-[11px] text-muted/50 mt-0.5">
                    {post.author}
                  </span>
                )}
              </div>

              {/* Title + excerpt + tags */}
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-body leading-snug group-hover:text-primary-500 transition-colors">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="text-sm text-muted leading-relaxed mt-1 line-clamp-2">
                    {post.excerpt}
                  </p>
                )}
                {post.tags && post.tags.length > 0 && (
                  <div className="mt-2">
                    <Tags tags={post.tags} />
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {data.totalPages > 1 && (
        <Pagination
          currentPage={data.currentPage}
          totalPages={data.totalPages}
        />
      )}
    </div>
  )
}
