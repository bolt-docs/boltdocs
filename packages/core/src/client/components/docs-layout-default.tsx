import { useState, useEffect } from 'react'
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
import { Feedback, Giscus } from './ui-base'
import { useMergedComponents } from '../hooks/use-merged-components'

interface DocsLayoutThemeProps {
  children?: React.ReactNode
}

function DocsLayoutComponent({ children }: DocsLayoutThemeProps) {
  const { routes: filteredRoutes, currentRoute, isCollectionPage } = useRoutes()
  const config = useConfig()
  const components = useMergedComponents()
  const AskAiDialog = components.AskAiDialog as React.ComponentType
  const [isAskAiOpen, setIsAskAiOpen] = useState(false)

  useEffect(() => {
    const handleOpen = () => setIsAskAiOpen(true)
    const handleClose = () => setIsAskAiOpen(false)
    window.addEventListener('boltdocs:ask-ai:open', handleOpen)
    window.addEventListener('boltdocs:ask-ai:close', handleClose)
    return () => {
      window.removeEventListener('boltdocs:ask-ai:open', handleOpen)
      window.removeEventListener('boltdocs:ask-ai:close', handleClose)
    }
  }, [])

  return (
    <DocsLayoutPrimitive className="selection:bg-primary-500/10 selection:text-primary-500">
      <Navbar />
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
              </DocsLayoutPrimitive.Header>
            )}

            <ErrorBoundary>
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                {children}
              </div>
            </ErrorBoundary>

            {!isCollectionPage && <Feedback />}
            {!isCollectionPage && <Giscus />}

            <DocsLayoutPrimitive.Footer>
              {!isCollectionPage && <PageNav />}
            </DocsLayoutPrimitive.Footer>
          </DocsLayoutPrimitive.ContentMdx>
        </DocsLayoutPrimitive.Content>

        {AskAiDialog && <AskAiDialog />}
        {!isCollectionPage && !isAskAiOpen && (
          <OnThisPage
            headings={currentRoute?.headings}
            filePath={currentRoute?.filePath}
            communityHelp={config.theme?.communityHelp}
            editLink={config.theme?.editLink}
          />
        )}
      </DocsLayoutPrimitive.Body>
    </DocsLayoutPrimitive>
  )
}

export default DocsLayoutComponent
