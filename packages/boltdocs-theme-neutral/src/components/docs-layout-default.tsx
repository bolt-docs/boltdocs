import type { ReactNode } from 'react'
import { DocsLayout as DocsLayoutPrimitive } from '@bdocs/ui-base/composition'
import { Navbar } from '@bdocs/ui-base'
import { Sidebar } from '@bdocs/ui-base'
import { Breadcrumbs } from '@bdocs/ui-base'
import { PageNav } from '@bdocs/ui-base'
import { ErrorBoundary } from '@bdocs/ui-base'
import { CopyMarkdown } from '@bdocs/ui-base'
import { OnThisPage } from '@bdocs/ui-base'
import { useRoutes, PluginSlot } from '@bdocs/runtime'
import { useConfig } from '@bdocs/runtime'
import { Outlet } from '@bdocs/runtime'
import { Giscus } from '@bdocs/ui-base'
import type { ComponentRoute } from '@bdocs/runtime'

interface DocsLayoutThemeProps {
  children?: ReactNode
}

/**
 * Default docs layout — composes the visual primitives and places the two
 * page-level plugin slots around the content. The other slots live in the
 * navbar, sidebar and search dialog, next to what they decorate.
 *
 * A custom layout can reuse any primitive and place the same slot hosts.
 *
 * Styling is in `styles/components/docs-layout.css` and
 * `styles/components/page-header.css`. Nothing here is a utility class.
 */
function DocsLayoutComponent({ children }: DocsLayoutThemeProps) {
  const { routes: filteredRoutes, currentRoute, isCollectionPage } = useRoutes()
  const config = useConfig()

  return (
    <DocsLayoutPrimitive>
      <Navbar />
      <DocsLayoutPrimitive.Body>
        {!isCollectionPage && (
          <Sidebar routes={filteredRoutes || []} config={config} />
        )}
        <DocsLayoutPrimitive.Content>
          <DocsLayoutPrimitive.ContentMdx className="bdocs-page__padded">
            {!isCollectionPage && (
              <DocsLayoutPrimitive.Header>
                <div className="bdocs-page__meta">
                  <Breadcrumbs />
                  <CopyMarkdown
                    mdxRaw={currentRoute?._rawContent}
                    route={currentRoute}
                  />
                </div>

                {currentRoute?.title && (
                  <h1 className="bdocs-page__title">{currentRoute.title}</h1>
                )}
                {currentRoute?.description && (
                  <p className="bdocs-page__description">
                    {currentRoute.description}
                  </p>
                )}
              </DocsLayoutPrimitive.Header>
            )}

            <PluginSlot name="page:before" />

            <ErrorBoundary>
              <div className="bdocs-prose">{children ?? <Outlet />}</div>
            </ErrorBoundary>

            <PluginSlot name="page:after" />

            {!isCollectionPage && <Giscus />}

            {!isCollectionPage && (
              <div className="bdocs-page__pagenav">
                <PageNav />
              </div>
            )}
          </DocsLayoutPrimitive.ContentMdx>
        </DocsLayoutPrimitive.Content>
        <div className="bdocs-layout__aside">
          <OnThisPage
            headings={currentRoute?.headings}
            filePath={currentRoute?.filePath}
            communityHelp={config.theme?.communityHelp}
            editLink={config.theme?.editLink}
          />
        </div>
      </DocsLayoutPrimitive.Body>
    </DocsLayoutPrimitive>
  )
}

export default DocsLayoutComponent
export type { ComponentRoute }
