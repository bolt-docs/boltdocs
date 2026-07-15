import type { ComponentType } from 'react'
import { DocsLayout as DocsLayoutPrimitive } from './primitives/docs-layout'
import { Navbar } from './ui-base/navbar'
import { Sidebar } from './ui-base/sidebar'
import { Breadcrumbs } from './ui-base/breadcrumbs'
import { PageNav } from './ui-base/page-nav'
import { ErrorBoundary } from './ui-base/error-boundary'
import { CopyMarkdown } from './ui-base/copy-markdown'
import { OnThisPage } from './ui-base/on-this-page'
import { useRoutes } from '../hooks/use-routes'
import {
  useSlotComponents,
  useSlotRegistry,
  type SlotComponent,
} from '../hooks/use-slot-registry'
import { useConfig } from '../app/config-context'
import { Feedback, Giscus } from './ui-base'
import type { ComponentRoute } from '../types'

interface DocsLayoutThemeProps {
  children?: React.ReactNode
}

/**
 * Render an array of slot components. Each component receives the current
 * route as a prop so it can adapt its rendering.
 */
function SlotGroup({
  components,
  route,
}: {
  components: readonly SlotComponent[]
  route: ComponentRoute | undefined
}) {
  if (components.length === 0) return null
  return (
    <>
      {components.map((Comp, i) => (
        <Comp key={i} route={route} />
      ))}
    </>
  )
}

function DocsLayoutComponent({ children }: DocsLayoutThemeProps) {
  const { routes: filteredRoutes, currentRoute, isCollectionPage } = useRoutes()
  const config = useConfig()

  // Resolve the slot registry once. Hook is memoized.
  useSlotRegistry()

  const floatingBottom = useSlotComponents('floating-bottom')
  const rightRail = useSlotComponents('right-rail')
  const navbarExtra = useSlotComponents('navbar-extra')
  const headerExtra = useSlotComponents('header-extra')
  const tocExtra = useSlotComponents('toc-extra')
  const footerExtra = useSlotComponents('footer-extra')
  const bodyPortal = useSlotComponents('body-portal')

  return (
    <DocsLayoutPrimitive className="selection:bg-primary-500/10 selection:text-primary-500">
      <Navbar>
        <SlotGroup components={navbarExtra} route={currentRoute} />
      </Navbar>

      <DocsLayoutPrimitive.Body className="bg-main">
        {!isCollectionPage && (
          <Sidebar routes={filteredRoutes || []} config={config} />
        )}
        <DocsLayoutPrimitive.Content className="animate-in fade-in duration-500 scroll-smooth">
          <DocsLayoutPrimitive.ContentMdx className="max-w-3xl sm:max-w-4xl lg:max-w-5xl px-4 sm:px-6 pt-8 pb-24">
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

                <SlotGroup components={headerExtra} route={currentRoute} />
              </DocsLayoutPrimitive.Header>
            )}

            <ErrorBoundary>
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                {children}
              </div>
            </ErrorBoundary>

            {!isCollectionPage && (Feedback as any)({})}
            {!isCollectionPage && (Giscus as any)({})}

            <DocsLayoutPrimitive.Footer>
              <SlotGroup components={footerExtra} route={currentRoute} />
              {!isCollectionPage && <PageNav />}
            </DocsLayoutPrimitive.Footer>
          </DocsLayoutPrimitive.ContentMdx>
        </DocsLayoutPrimitive.Content>

        <OnThisPage
          headings={currentRoute?.headings}
          filePath={currentRoute?.filePath}
          communityHelp={config.theme?.communityHelp}
          editLink={config.theme?.editLink}
        />

        <DocsLayoutPrimitive.TocExtras>
          <SlotGroup components={tocExtra} route={currentRoute} />
        </DocsLayoutPrimitive.TocExtras>
      </DocsLayoutPrimitive.Body>

      {/* Floating layers rendered OUTSIDE the Body flex so they can escape horizontal layout */}
      <DocsLayoutPrimitive.RightRail>
        <SlotGroup components={rightRail} route={currentRoute} />
      </DocsLayoutPrimitive.RightRail>
      <DocsLayoutPrimitive.FloatingBottom>
        <SlotGroup components={floatingBottom} route={currentRoute} />
      </DocsLayoutPrimitive.FloatingBottom>
      <DocsLayoutPrimitive.BodyPortal>
        <SlotGroup components={bodyPortal} route={currentRoute} />
      </DocsLayoutPrimitive.BodyPortal>
    </DocsLayoutPrimitive>
  )
}

export default DocsLayoutComponent
