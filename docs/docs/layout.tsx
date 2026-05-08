import {
  DocsLayout,
  Navbar,
  Sidebar,
  OnThisPage,
  Breadcrumbs,
  PageNav,
  ErrorBoundary,
  CopyMarkdown,
  useRoutes,
  useConfig,
} from 'boltdocs/client'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { routes: filteredRoutes, currentRoute } = useRoutes()
  const config = useConfig()

  return (
    <DocsLayout>
      <Navbar />
      <DocsLayout.Body>
        <Sidebar routes={filteredRoutes} config={config} />
        <DocsLayout.Content>
          <DocsLayout.ContentMdx>
            <DocsLayout.ContentHeader>
              <Breadcrumbs />
              <CopyMarkdown
                mdxRaw={currentRoute?._rawContent}
                route={currentRoute}
              />
            </DocsLayout.ContentHeader>

            <ErrorBoundary>{children}</ErrorBoundary>

            <DocsLayout.ContentFooter>
              <PageNav />
            </DocsLayout.ContentFooter>
          </DocsLayout.ContentMdx>
        </DocsLayout.Content>
        <OnThisPage
          headings={currentRoute?.headings}
          editLink={config.theme?.editLink}
          communityHelp={config.theme?.communityHelp}
          filePath={currentRoute?.filePath}
        />
      </DocsLayout.Body>
    </DocsLayout>
  )
}
