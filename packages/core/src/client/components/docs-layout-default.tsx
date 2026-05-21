import { DocsLayout as DocsLayoutPrimitive } from './primitives/docs-layout'
import { Navbar } from './ui-base/navbar'
import { Sidebar } from './ui-base/sidebar'
import { OnThisPage } from './ui-base/on-this-page'
import { Breadcrumbs } from './ui-base/breadcrumbs'
import { PageNav } from './ui-base/page-nav'
import { ErrorBoundary } from './ui-base/error-boundary'
import { CopyMarkdown } from './ui-base/copy-markdown'
import { useRoutes } from '../hooks/use-routes'
import { useConfig } from '../app/config-context'

interface DocsLayoutThemeProps {
  children?: React.ReactNode
}

/**
 * Pre-assembled high-fidelity documentation layout component.
 * Fully styled and optimized to adapt seamlessly to our custom Parchment/Slate theme.
 */
function DocsLayoutComponent({ children }: DocsLayoutThemeProps) {
  const { routes: filteredRoutes, currentRoute } = useRoutes()
  const config = useConfig()

  return (
    <DocsLayoutPrimitive className="selection:bg-primary-500/10 selection:text-primary-500">
      <Navbar />
      <DocsLayoutPrimitive.Body className="bg-main">
        <Sidebar routes={filteredRoutes || []} config={config} />
        <DocsLayoutPrimitive.Content className="animate-in fade-in duration-500 scroll-smooth">
          <DocsLayoutPrimitive.ContentMdx className="max-w-5xl px-2 pt-8 pb-24">
            <DocsLayoutPrimitive.Header>
              <div className="mb-4 border-b border-subtle pb-4 flex flex-wrap items-center justify-between gap-3">
                <Breadcrumbs />
                <CopyMarkdown
                  mdxRaw={currentRoute?._rawContent}
                  route={currentRoute}
                />
              </div>

              {/* Inject Main Page Heading automatically */}
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

            <ErrorBoundary>
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                {children}
              </div>
            </ErrorBoundary>

            <DocsLayoutPrimitive.Footer>
              <PageNav />
            </DocsLayoutPrimitive.Footer>
          </DocsLayoutPrimitive.ContentMdx>
        </DocsLayoutPrimitive.Content>
        <OnThisPage
          headings={currentRoute?.headings}
          editLink={config.theme?.editLink}
          communityHelp={config.theme?.communityHelp}
          filePath={currentRoute?.filePath}
        />
      </DocsLayoutPrimitive.Body>
    </DocsLayoutPrimitive>
  )
}

// Expose the primitive sub-components directly on the Default DocsLayout
// to maintain complete backward-compatibility for custom theme assemblies.
export const DocsLayout = Object.assign(DocsLayoutComponent, {
  Body: DocsLayoutPrimitive.Body,
  Content: DocsLayoutPrimitive.Content,
  ContentMdx: DocsLayoutPrimitive.ContentMdx,
  Header: DocsLayoutPrimitive.Header,
  Footer: DocsLayoutPrimitive.Footer,
}) as any

export default DocsLayout
