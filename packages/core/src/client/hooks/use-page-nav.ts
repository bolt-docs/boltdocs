import { useMemo } from 'react'
import { useLocation } from '../router'
import { useRoutes } from './use-routes'
import { useSidebar } from './use-sidebar'
import { normalizePath } from '../utils/path'
import type { ComponentRoute } from '../types'

export function usePageNav() {
  const { routes, currentRoute } = useRoutes()
  const location = useLocation()
  const { groups, ungrouped } = useSidebar(routes)

  return useMemo(() => {
    if (!currentRoute) {
      return {
        prevPage: null,
        nextPage: null,
        currentRoute: null,
      }
    }

    // Merge groups and ungrouped into a single sorted list matching the sidebar visual order
    const mergedItems = [
      ...ungrouped.map((route) => ({
        type: 'link' as const,
        position: route.sidebarPosition ?? 999,
        title: route.title,
        route,
      })),
      ...groups.map((group) => ({
        type: 'group' as const,
        position: group.sidebarPosition ?? 999,
        title: group.title,
        group,
      })),
    ].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position
      if (a.type !== b.type) {
        return a.type === 'link' ? -1 : 1
      }
      return a.title.localeCompare(b.title)
    })

    const orderedRoutes: ComponentRoute[] = []

    const flattenNode = (node: ComponentRoute) => {
      if (!node) return
      if (node.path && node.path !== '#' && !node.sidebarHidden) {
        orderedRoutes.push(node)
      }
      const children = node.routes || node.subRoutes
      if (children && children.length > 0) {
        for (const child of children) {
          if (child) flattenNode(child)
        }
      }
    }

    for (const item of mergedItems) {
      if (item.type === 'link') {
        if (item.route) flattenNode(item.route)
      } else {
        if (item.group.routes) {
          for (const route of item.group.routes) {
            if (route) flattenNode(route)
          }
        }
      }
    }

    const currentNormalizedPath = normalizePath(location.pathname)
    const currentIndex = orderedRoutes.findIndex(
      (r) => r && r.path && normalizePath(r.path) === currentNormalizedPath,
    )

    const prevPage = currentIndex > 0 ? orderedRoutes[currentIndex - 1] : null
    const nextPage =
      currentIndex !== -1 && currentIndex < orderedRoutes.length - 1
        ? orderedRoutes[currentIndex + 1]
        : null

    return {
      prevPage,
      nextPage,
      currentRoute,
    }
  }, [groups, ungrouped, currentRoute, location.pathname])
}
