import { Outlet } from 'react-router-dom'
import UserLayout from 'virtual:boltdocs-layout'
import { useRoutes } from '../hooks/use-routes'

/**
 * Wraps the docs Outlet with the user's (or default) layout component.
 * The Layout receives the routed page as `children`.
 * We use useRoutes to pass the current route context to the persistent layout.
 */
export function DocsLayout() {
  const { currentRoute } = useRoutes()

  return (
    <UserLayout route={currentRoute}>
      <Outlet />
    </UserLayout>
  )
}
