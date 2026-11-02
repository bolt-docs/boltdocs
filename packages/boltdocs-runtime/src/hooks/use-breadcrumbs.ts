import { useRoutes } from './use-routes'

/**
 * Hook to generate breadcrumbs based on the current active route.
 */
export function useBreadcrumbs() {
  const { currentRoute: activeRoute } = useRoutes()

  const crumbs: Array<{ label: string; href?: string }> = []

  if (activeRoute) {
    if (activeRoute.groupTitle) {
      crumbs.push({ label: activeRoute.groupTitle })
    }
    crumbs.push({ label: activeRoute.title, href: activeRoute.path })
  }

  return {
    crumbs,
    activeRoute,
  }
}
