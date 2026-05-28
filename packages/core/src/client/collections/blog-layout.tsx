import { Outlet } from 'react-router-dom'
import { CollectionsContext } from './collections-context'
import type { CollectionsData } from './collections-context'
import { OnThisPage } from '../components/ui-base/on-this-page'
import { useHeadings } from '../hooks/use-headings'

/**
 * Default layout for collection (blog) routes.
 *
 * Wraps child routes in the `CollectionsContext` provider so that
 * `usePosts()`, `usePost()`, and `useRecentPosts()` hooks work inside
 * collection pages without prop-drilling.
 */
export function BlogLayout({
  collectionsData,
}: {
  collectionsData: CollectionsData
}) {
  const headings = useHeadings()

  return (
    <CollectionsContext.Provider value={collectionsData}>
      <div className="h-screen flex flex-col overflow-hidden">
        <div className="flex-1 flex mx-auto w-full max-w-(--breakpoint-3xl) overflow-hidden">
          <main className="flex-1 min-w-0 overflow-y-auto boltdocs-content">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <Outlet />
            </div>
          </main>

          <aside className="sticky top-0 p-6 hidden lg:block shrink-0">
            <OnThisPage headings={headings} />
          </aside>
        </div>
      </div>
    </CollectionsContext.Provider>
  )
}
