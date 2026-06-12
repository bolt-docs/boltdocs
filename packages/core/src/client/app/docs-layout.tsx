import { Outlet } from 'react-router-dom'
import UserLayout from 'virtual:boltdocs-layout'
import { useRoutes } from '../hooks/use-routes'
import { CollectionsContext } from '../collections/collections-context'
import type { CollectionsData } from '../collections/collections-context'
import { InternalErrorBoundary as ErrorBoundary } from '../components/internal/error-boundary'

export function DocsLayout({
  collectionsData,
}: {
  collectionsData?: CollectionsData
}) {
  const { currentRoute } = useRoutes()

  const content = (
    <ErrorBoundary>
      <UserLayout route={currentRoute}>
        <Outlet />
      </UserLayout>
    </ErrorBoundary>
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
