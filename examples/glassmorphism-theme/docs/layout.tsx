import React from 'react'
import {
  DocsLayout,
  OnThisPage,
  Head,
  Breadcrumbs,
  PageNav,
  ErrorBoundary,
  useRoutes,
  useConfig,
  useMdxComponents,
} from 'boltdocs/client'
import { useLocation } from 'react-router-dom'
import { CopyMarkdown } from 'boltdocs/client'

// Import custom theme components
import { CustomNavbar as Navbar } from '../components/theme/navbar'
import { CustomSidebar as Sidebar } from '../components/theme/sidebar'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { routes: filteredRoutes, allRoutes, currentRoute } = useRoutes()
  const { pathname } = useLocation()
  const config = useConfig()
  const mdxComponents = useMdxComponents()

  // Allow CopyMarkdown override via mdx-components.tsx
  const CopyMarkdownComp = (mdxComponents.CopyMarkdown as any) || CopyMarkdown

  const isDocs = pathname.startsWith('/docs')

  return (
    <DocsLayout className="!bg-transparent boltdocs-layout-root">
      <Head
        siteTitle={config.theme?.title || 'Boltdocs'}
        siteDescription={config.theme?.description || ''}
        routes={allRoutes}
      />

      {/* Global Mesh Gradient Background Layer - FIXED and BEHIND EVERYTHING */}
      <div className="fixed inset-0 pointer-events-none -z-50 overflow-hidden bg-main">
        <div className="absolute top-[-10%] left-[-5%] w-[70%] h-[70%] bg-primary-500/20 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[60%] bg-purple-600/15 blur-[130px] rounded-full" />
        <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] bg-blue-400/15 blur-[110px] rounded-full animate-pulse" />
        <div className="absolute bottom-[20%] left-[15%] w-[35%] h-[35%] bg-emerald-500/10 blur-[100px] rounded-full" />
      </div>

      <Navbar />

      <DocsLayout.Body className="!bg-transparent! boltdocs-layout-body">
        {isDocs && <Sidebar routes={filteredRoutes} />}

        <DocsLayout.Content className="!bg-transparent! boltdocs-layout-content">
          <DocsLayout.ContentMdx className="animate-fade-in !bg-transparent!">
            {isDocs && (
              <DocsLayout.ContentHeader className="!bg-transparent">
                <Breadcrumbs />
                <CopyMarkdownComp
                  mdxRaw={currentRoute?._rawContent}
                  route={currentRoute}
                />
              </DocsLayout.ContentHeader>
            )}

            <div className="relative z-10">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>

            {isDocs && (
              <DocsLayout.ContentFooter className="!bg-transparent">
                <PageNav />
              </DocsLayout.ContentFooter>
            )}
          </DocsLayout.ContentMdx>
        </DocsLayout.Content>

        {isDocs && (
          <OnThisPage
            headings={currentRoute?.headings}
            className="boltdocs-on-this-page !bg-transparent!"
          />
        )}
      </DocsLayout.Body>
    </DocsLayout>
  )
}
