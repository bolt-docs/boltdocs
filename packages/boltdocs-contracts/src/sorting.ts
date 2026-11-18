/**
 * Shared collection ordering.
 *
 * Engine and runtime used four byte-identical copies of this comparator. The
 * behavior is part of the public contract: newest first, undated posts last,
 * and paths ascending as a deterministic tie-breaker (also used when both
 * posts are undated, so SSR and client agree).
 */
export type CollectionSortBy = 'date' | 'title' | 'sidebarPosition'

export interface CollectionSortable {
  path: string
  title?: string
  sidebarPosition?: number
  date?: string | Date
}

const NO_DATE = Number.NEGATIVE_INFINITY

function timestamp(date: string | Date | undefined): number {
  if (!date) return NO_DATE
  const value = new Date(date).getTime()
  return Number.isFinite(value) ? value : NO_DATE
}

/** Compare posts newest-first; undated posts go last, ties by path. */
export function compareByDateDesc<T extends CollectionSortable>(
  a: T,
  b: T,
): number {
  const dateA = timestamp(a.date)
  const dateB = timestamp(b.date)
  // Subtracting two `-Infinity` values gives NaN, which a sort treats as equal
  // and leaves undated posts in input order instead of applying the path tie.
  if (dateA === dateB) return a.path.localeCompare(b.path)
  return dateB - dateA
}

/** Compare posts using the configured `collections.sortBy` mode. */
export function compareCollections<T extends CollectionSortable>(
  a: T,
  b: T,
  sortBy: CollectionSortBy = 'date',
): number {
  if (sortBy === 'title') {
    return (
      (a.title ?? '').localeCompare(b.title ?? '') ||
      a.path.localeCompare(b.path)
    )
  }
  if (sortBy === 'sidebarPosition') {
    return (
      (a.sidebarPosition ?? 999) - (b.sidebarPosition ?? 999) ||
      (a.title ?? '').localeCompare(b.title ?? '') ||
      a.path.localeCompare(b.path)
    )
  }
  return compareByDateDesc(a, b)
}

/** Sort a copy with the configured mode. Defaults to newest-first by date. */
export function sortCollectionPosts<T extends CollectionSortable>(
  posts: readonly T[],
  sortBy: CollectionSortBy = 'date',
): T[] {
  return [...posts].sort((a, b) => compareCollections(a, b, sortBy))
}

/** Sort a copy of `posts` newest-first using {@link compareByDateDesc}. */
export function sortByDateDesc<T extends CollectionSortable>(
  posts: readonly T[],
): T[] {
  return [...posts].sort(compareByDateDesc)
}
