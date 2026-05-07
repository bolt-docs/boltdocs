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
  useMdxComponents,
  useLocation,
  getTranslated,
} from 'boltdocs/client'

export default function Layout({ children }: { children: React.ReactNode }) {
  const {
    routes: filteredRoutes,
    allRoutes,
    currentRoute,
    currentLocale,
  } = useRoutes()
  const { pathname } = useLocation()
  const config = useConfig()
  const mdxComponents = useMdxComponents()

  // Allow CopyMarkdown override via mdx-components.tsx
  const CopyMarkdownComp = (mdxComponents.CopyMarkdown as any) || CopyMarkdown

  const isDocs = pathname.startsWith('/docs')

  return (
    <DocsLayout>
      <Head
        siteTitle={
          getTranslated(config.theme?.title, currentLocale) || 'Boltdocs'
        }
        siteDescription={
          getTranslated(config.theme?.description, currentLocale) || ''
        }
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
                <CopyMarkdownComp
                  mdxRaw={currentRoute?._rawContent}
                  route={currentRoute}
                  config={config.theme?.copyMarkdown}
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
