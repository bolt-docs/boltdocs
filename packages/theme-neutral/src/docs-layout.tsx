import { Outlet } from '@bdocs/runtime'
import { getSiteLayout } from '@bdocs/runtime'
import { useRoutes } from './hooks/use-routes'
import { CollectionsContext } from './collections/collections-context'
import type { CollectionsData } from './collections/collections-context'
import { InternalErrorBoundary as ErrorBoundary } from './components/internal/error-boundary'
import { DocRouteProvider } from '@bdocs/runtime'

export function DocsLayout({
  collectionsData,
}: {
  collectionsData?: CollectionsData
}) {
  const { currentRoute } = useRoutes()

  // A site with no `layout.tsx` renders the default layout directly. Wrapping
  // in a passthrough component when there is nothing to wrap would add a layer
  // that shows up in every React DevTools trace and every snapshot test for no
  // benefit.
  const UserLayout = getSiteLayout()
  const inner = UserLayout ? (
    <UserLayout route={currentRoute}>
      <Outlet />
    </UserLayout>
  ) : (
    <Outlet />
  )

  const content = (
    <DocRouteProvider value={currentRoute}>
      <ErrorBoundary>{inner}</ErrorBoundary>
    </DocRouteProvider>
  )

  if (collectionsData) {
    return (
      <CollectionsContext.Provider value={collectionsData}>
        {content}
      </CollectionsContext.Provider>
    )
  }

  return content
}
