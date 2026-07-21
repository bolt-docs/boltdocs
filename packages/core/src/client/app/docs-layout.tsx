import { Outlet } from 'react-router-dom'
import UserLayout from 'virtual:boltdocs-layout'
import { useRoutes } from '../hooks/use-routes'
import { CollectionsContext } from '../collections/collections-context'
import type { CollectionsData } from '../collections/collections-context'
import { InternalErrorBoundary as ErrorBoundary } from '../components/internal/error-boundary'
import { DocRouteProvider } from './doc-route-context'

export function DocsLayout({
  collectionsData,
}: {
  collectionsData?: CollectionsData
}) {
  const { currentRoute } = useRoutes()

  const content = (
    <DocRouteProvider value={currentRoute}>
      <ErrorBoundary>
        <UserLayout route={currentRoute}>
          <Outlet />
        </UserLayout>
      </ErrorBoundary>
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
