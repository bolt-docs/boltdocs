import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useRoutes } from './use-routes'

/**
 * Hook to manage the previous and next button functionality for documentation pages.
 * Intelligent: respects current locale, version, and tab to keep navigation logical.
 */
export function usePageNav() {
  const { routes, currentRoute } = useRoutes()
  const location = useLocation()

  return useMemo(() => {
    if (!currentRoute) {
      return {
        prevPage: null,
        nextPage: null,
        currentRoute: null,
      }
    }

    const activeTabId = currentRoute.tab?.toLowerCase()

    // Subset of routes that match the current context (locale and version are already filtered by useRoutes)
    // We further filter by tab to keep the user in the same logical section
    const contextRoutes = activeTabId
      ? routes.filter((r) => r.tab?.toLowerCase() === activeTabId)
      : routes.filter((r) => !r.tab)

    const currentIndex = contextRoutes.findIndex(
      (r) => r.path === location.pathname,
    )

    const prevPage = currentIndex > 0 ? contextRoutes[currentIndex - 1] : null
    const nextPage =
      currentIndex !== -1 && currentIndex < contextRoutes.length - 1
        ? contextRoutes[currentIndex + 1]
        : null

    return {
      prevPage,
      nextPage,
      currentRoute,
    }
  }, [routes, currentRoute, location.pathname])
}
