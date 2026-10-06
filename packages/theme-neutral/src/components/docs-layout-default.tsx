import type { ReactNode } from 'react'
import { DocsLayout as DocsLayoutPrimitive } from './primitives/docs-layout'
import { Navbar } from './ui-base/navbar'
import { Sidebar } from './ui-base/sidebar'
import { Breadcrumbs } from './ui-base/breadcrumbs'
import { PageNav } from './ui-base/page-nav'
import { ErrorBoundary } from './ui-base/error-boundary'
import { CopyMarkdown } from './ui-base/copy-markdown'
import { OnThisPage } from './ui-base/on-this-page'
import { useRoutes } from '../hooks/use-routes'
import { useConfig } from '@bdocs/runtime'
import { Outlet } from '@bdocs/runtime'
import { Feedback, Giscus } from './ui-base/index'
import type { ComponentRoute } from '@bdocs/runtime'

interface DocsLayoutThemeProps {
  children?: ReactNode
}

/**
 * Default docs layout — composes the visual primitives and delegates
 * sub-area routing to them. Slot rendering (plugin injections at
 * `navbar:end`, `sidebar:bottom`, `docs-content:top`, etc.) is handled
 * internally by each primitive so the layout itself does no slot "magic".
 *
 * A custom layout can reuse any primitive and the slot wiring just works.
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

            <ErrorBoundary>
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                {children ?? <Outlet />}
              </div>
            </ErrorBoundary>

            {!isCollectionPage && <Feedback />}
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
