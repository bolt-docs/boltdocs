import { Outlet } from 'react-router-dom'
import UserLayout from 'virtual:boltdocs-layout'
import { useRoutes } from '../hooks/use-routes'
import { useConfig } from './config-context'
import { Head } from './head'
import { CollectionsContext } from '../collections/collections-context'
import type { CollectionsData } from '../collections/collections-context'

/**
 * Wraps the docs Outlet with the user's (or default) layout component.
 * The Layout receives the routed page as `children`.
 * We use useRoutes to pass the current route context to the persistent layout.
 */
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
      <UserLayout route={currentRoute}>
        <Outlet />
      </UserLayout>
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
