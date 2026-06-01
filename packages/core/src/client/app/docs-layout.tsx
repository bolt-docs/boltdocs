import { Outlet } from 'react-router-dom'
import UserLayout from 'virtual:boltdocs-layout'
import { useRoutes } from '../hooks/use-routes'
import { useConfig } from './config-context'
import { Head } from './head'
import { CollectionsContext } from '../collections/collections-context'
import type { CollectionsData } from '../collections/collections-context'
import { InternalErrorBoundary as ErrorBoundary } from '../components/internal/error-boundary'

export function DocsLayout({
  collectionsData,
}: {
  collectionsData?: CollectionsData
}) {
  const config = useConfig()
  const { currentRoute, allRoutes } = useRoutes()

  const content = (
    <>
      <Head
        siteTitle={config.theme?.title}
        siteDescription={config.theme?.description}
        routes={allRoutes || []}
      />
      <ErrorBoundary>
        <UserLayout route={currentRoute}>
          <Outlet />
        </UserLayout>
      </ErrorBoundary>
    </>
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
