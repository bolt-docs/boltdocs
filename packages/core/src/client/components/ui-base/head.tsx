import { useLocation } from 'react-router-dom'
import type { ComponentType, ReactNode } from 'react'
import * as ReactHelmetAsync from 'react-helmet-async'
import { useConfig } from '../../app/config-context'

type HelmetModule = {
  Helmet?: ComponentType<{ children?: ReactNode }>
  default?: { Helmet?: ComponentType<{ children?: ReactNode }> }
}
const helmetModule = ReactHelmetAsync as unknown as HelmetModule
const Helmet =
  helmetModule.Helmet ||
  helmetModule.default?.Helmet ||
  (({ children }) => <>{children}</>)

interface HeadProps {
  siteTitle: string
  siteDescription?: string
  routes: Array<{
    path: string
    title: string
    description?: string
    seo?: Record<string, unknown>
  }>
}

export function Head({ siteTitle, siteDescription, routes }: HeadProps) {
  const location = useLocation()
  const config = useConfig()

  // Find the current route's metadata
  const currentRoute = routes?.find?.((r) => r.path === location.pathname)
  const pageTitle = currentRoute?.title
  const pageDescription = currentRoute?.description || siteDescription || ''

  const finalTitle = pageTitle ? `${pageTitle} | ${siteTitle}` : siteTitle

  const seo = currentRoute?.seo || {}

  // Merge custom global metatags
  const globalMetatags = config?.seo?.metatags || {}

  // Calculate specific ones
  const defaultOgImage = config?.seo?.thumbnails?.background
  const ogImage = seo['og:image'] || defaultOgImage

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={pageDescription} />

      {/* Default OG Tags */}
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:type" content="article" />
      {/* Canonical URL for both <link> and og:url */}
      {typeof window !== 'undefined' && (
        <meta property="og:url" content={window.location.href} />
      )}
      {typeof window !== 'undefined' && (
        <link
          rel="canonical"
          href={window.location.origin + location.pathname}
        />
      )}

      {/* Default Twitter Card */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={pageDescription} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}
      {ogImage && <meta property="og:image" content={ogImage} />}

      {/* Generator */}
      <meta name="generator" content="Boltdocs" />

      {/* User-defined global metatags */}
      {Object.entries(globalMetatags).map(([key, value]) => {
        const isProperty =
          key.startsWith('og:') ||
          key.startsWith('music:') ||
          key.startsWith('video:') ||
          key.startsWith('article:') ||
          key.startsWith('book:') ||
          key.startsWith('profile:')
        return isProperty ? (
          <meta key={key} property={key} content={value as string} />
        ) : (
          <meta key={key} name={key} content={value as string} />
        )
      })}

      {/* Page granular SEO tags (override global) */}
      {Object.entries(seo).map(([key, value]) => {
        if (key === 'noindex' && value === true)
          return <meta key="noindex" name="robots" content="noindex" />
        if (key === 'robots')
          return <meta key="robots" name="robots" content={value as string} />
        if (key === 'canonical')
          return <link key="canonical" rel="canonical" href={value as string} />

        const isProperty =
          key.startsWith('og:') ||
          key.startsWith('music:') ||
          key.startsWith('video:') ||
          key.startsWith('article:') ||
          key.startsWith('book:') ||
          key.startsWith('profile:')
        return isProperty ? (
          <meta key={key} property={key} content={value as string} />
        ) : (
          <meta key={key} name={key} content={value as string} />
        )
      })}
    </Helmet>
  )
}
