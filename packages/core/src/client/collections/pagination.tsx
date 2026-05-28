import { Link } from '../components/primitives/link'
import { ChevronLeft, ChevronRight } from '../components/ui-base/icons'

interface PaginationProps {
  currentPage: number
  totalPages: number
  /**
   * The base URL path of this collection (e.g. `'/blog'`, `'/news'`).
   * Used to build page URLs like `/blog/page/2`.
   */
  collection: string
}

export function Pagination({ currentPage, totalPages, collection }: PaginationProps) {
  if (totalPages <= 1) return null

  const collectionBase = collection.startsWith('/') ? collection : `/${collection}`

  const pages: (number | 'ellipsis')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis')
    }
  }

  const pageUrl = (page: number) =>
    page === 1 ? collectionBase : `${collectionBase}/page/${page}`

  return (
    <nav
      className="flex items-center justify-center gap-1 pt-8"
      aria-label="Pagination"
    >
      {currentPage > 1 && (
        <Link
          href={pageUrl(currentPage - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-subtle bg-main px-3 py-2 text-xs font-medium text-muted hover:text-body hover:border-primary-500/30 transition-colors"
        >
          <ChevronLeft size={14} />
          Previous
        </Link>
      )}

      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-2 text-muted text-xs">
              ...
            </span>
          ) : (
            <Link
              key={p}
              href={pageUrl(p)}
              className={`inline-flex items-center justify-center min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${
                p === currentPage
                  ? 'bg-primary-500 text-white'
                  : 'text-muted hover:text-body hover:bg-subtle'
              }`}
            >
              {p}
            </Link>
          ),
        )}
      </div>

      {currentPage < totalPages && (
        <Link
          href={pageUrl(currentPage + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-subtle bg-main px-3 py-2 text-xs font-medium text-muted hover:text-body hover:border-primary-500/30 transition-colors"
        >
          Next
          <ChevronRight size={14} />
        </Link>
      )}
    </nav>
  )
}
