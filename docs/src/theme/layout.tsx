import type { ReactNode } from 'react'
import { DocsLayout as DocsLayoutPrimitive } from 'boltdocs/primitives'
import { Navbar } from '@/theme/navbar'
import { Sidebar } from '@/theme/sidebar'
import { ErrorBoundary } from 'boltdocs/client'
import { CopyMarkdown } from '@/theme/copy-markdown'
import { OnThisPage } from '@/theme/on-this-page'
import { Feedback } from '@/theme/feedback'
import { useRoutes } from 'boltdocs/client'
import { useConfig } from 'boltdocs/client'
import { Outlet } from 'boltdocs/client'
import { PageNav } from '@/theme/page-nav'

function DocsThemeLayout({ children }: { children?: ReactNode }) {
  const { routes: filteredRoutes, currentRoute, isCollectionPage } = useRoutes()
  const config = useConfig()

  return (
    <DocsLayoutPrimitive className="selection:bg-primary-500/15 selection:text-primary-400">
      <Navbar />
      <DocsLayoutPrimitive.Body className="bg-main">
        {!isCollectionPage && (
          <Sidebar routes={filteredRoutes || []} config={config} />
        )}
        <DocsLayoutPrimitive.Content>
          <DocsLayoutPrimitive.ContentMdx className="pt-4 pb-20 px-28 max-sm:px-10">
            {!isCollectionPage && (
              <DocsLayoutPrimitive.Header className="mt-5">
                {currentRoute?.title && (
                  <h1 className="text-h1 font-bold tracking-tight text-body mb-3">
                    {currentRoute.title}
                  </h1>
                )}
                {currentRoute?.description && (
                  <p className="text-body-l text-muted mb-8 leading-relaxed max-w-(--spacing-content-max)">
                    {currentRoute.description}
                  </p>
                )}
                <CopyMarkdown
                  className="hidden max-xl:flex"
                  route={currentRoute}
                  mdxRaw={currentRoute?._rawContent}
                />
              </DocsLayoutPrimitive.Header>
            )}

            <ErrorBoundary>
              <div className="max-w-none text-paragraph text-base leading-relaxed font-features-['ss01','cv01']">
                {children ?? <Outlet />}
              </div>
            </ErrorBoundary>

            {!isCollectionPage && <Feedback />}

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

export default DocsThemeLayout
