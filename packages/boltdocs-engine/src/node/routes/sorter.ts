import type { RouteMeta } from './types'

/**
 * Sorts an array of generated routes.
 * Ungrouped items come first. Items within the same group are sorted by position, then alphabetically.
 * Groups are sorted relative to each other by their group position, then alphabetically.
 *
 * @param routes - The unsorted routes
 * @returns A new array of sorted routes suitable for sidebar generation
 */
export function sortRoutes(routes: RouteMeta[]): RouteMeta[] {
  return routes.sort((a, b) => {
    const posA = a.group ? (a.groupPosition ?? 999) : (a.sidebarPosition ?? 999)
    const posB = b.group ? (b.groupPosition ?? 999) : (b.sidebarPosition ?? 999)

    if (posA !== posB) {
      return posA - posB
    }

    // If effective category positions are identical, ungrouped items come first
    if (!a.group && b.group) return -1
    if (a.group && !b.group) return 1

    // If both are grouped in different groups, sort by group title/name
    if (a.group && b.group && a.group !== b.group) {
      return (a.groupTitle || a.group).localeCompare(b.groupTitle || b.group)
    }

    // Same group or both ungrouped: sort by item position/title/path.
    // The path tie-breaker makes the order total even when two routes share
    // the same title/position and were discovered by concurrent parsing.
    return compareByPosition(a, b)
  })
}

function compareByPosition(a: RouteMeta, b: RouteMeta): number {
  if (a.sidebarPosition !== undefined && b.sidebarPosition !== undefined) {
    const positionOrder = a.sidebarPosition - b.sidebarPosition
    if (positionOrder !== 0) return positionOrder
  } else if (a.sidebarPosition !== undefined) {
    return -1
  } else if (b.sidebarPosition !== undefined) {
    return 1
  }

  const titleOrder = a.title.localeCompare(b.title)
  if (titleOrder !== 0) return titleOrder
  return a.path.localeCompare(b.path)
}
