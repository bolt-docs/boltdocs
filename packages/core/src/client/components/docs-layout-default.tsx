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
import { useConfig } from '../app/config-context'
import { Outlet } from '../router'
import { Feedback, Giscus } from './ui-base'
import type { ComponentRoute } from '../types'

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
 */
function DocsLayoutComponent({ children }: DocsLayoutThemeProps) {
  const { routes: filteredRoutes, currentRoute, isCollectionPage } = useRoutes()
  const config = useConfig()

  return (
    <DocsLayoutPrimitive className="selection:bg-primary-500/10 selection:text-primary-500">
      <Navbar />
      <DocsLayoutPrimitive.Body className="bg-main">
        {!isCollectionPage && (
          <Sidebar routes={filteredRoutes || []} config={config} />
        )}
        <DocsLayoutPrimitive.Content>
          <DocsLayoutPrimitive.ContentMdx>
            {!isCollectionPage && (
              <DocsLayoutPrimitive.Header>
                <div className="mb-4 border-b border-subtle pb-4 flex flex-wrap items-center justify-between gap-3">
                  <Breadcrumbs />
                  <CopyMarkdown
                    mdxRaw={currentRoute?._rawContent}
                    route={currentRoute}
                  />
                </div>

                {currentRoute?.title && (
                  <h1 className="text-4xl font-bold tracking-tight text-default mb-3">
                    {currentRoute.title}
                  </h1>
                )}
                {currentRoute?.description && (
                  <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
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
              <div className="mt-20">
                <PageNav />
              </div>
            )}
          </DocsLayoutPrimitive.ContentMdx>
        </DocsLayoutPrimitive.Content>
        <div className="overflow-y-auto sticky">
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
