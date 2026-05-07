import {
  DocsLayout,
  Navbar,
  Sidebar,
  OnThisPage,
  Head,
  Breadcrumbs,
  PageNav,
  ErrorBoundary,
  CopyMarkdown,
  useRoutes,
  useConfig,
  useLocation,
} from 'boltdocs/client'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { routes: filteredRoutes, allRoutes, currentRoute } = useRoutes()
  const { pathname } = useLocation()
  const config = useConfig()

  const isDocs = pathname.startsWith('/docs')

  return (
    <DocsLayout>
      <Head
        siteTitle={config.theme?.title}
        siteDescription={config.theme?.description}
        routes={allRoutes}
      />
      <Navbar />

      <DocsLayout.Body>
        {isDocs && <Sidebar routes={filteredRoutes} config={config} />}

        <DocsLayout.Content>
          <DocsLayout.ContentMdx>
            {isDocs && (
              <DocsLayout.ContentHeader>
                <Breadcrumbs />
                <CopyMarkdown
                  mdxRaw={currentRoute?._rawContent}
                  route={currentRoute}
                />
              </DocsLayout.ContentHeader>
            )}

            <ErrorBoundary>{children}</ErrorBoundary>

            {isDocs && (
              <DocsLayout.ContentFooter>
                <PageNav />
              </DocsLayout.ContentFooter>
            )}
          </DocsLayout.ContentMdx>
        </DocsLayout.Content>

        {isDocs && (
          <OnThisPage
            headings={currentRoute?.headings}
            editLink={config.theme?.editLink}
            communityHelp={config.theme?.communityHelp}
            filePath={currentRoute?.filePath}
          />
        )}
      </DocsLayout.Body>
    </DocsLayout>
  )
}
