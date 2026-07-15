import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Helmet } from './helmet-compat'
import { useConfig } from './config-context'
import { getTranslated } from '../utils/i18n'
import { useRoutes } from '../hooks/use-routes'

interface HeadProps {
  siteTitle?: string | Record<string, string>
  siteDescription?: string | Record<string, string>
  routes: Array<{
    path: string
    title: string
    description?: string
    seo?: Record<string, unknown>
    coverImage?: string
  }>
}

export function Head({ siteTitle, siteDescription, routes }: HeadProps) {
  const location = useLocation()
  const config = useConfig()
  const { currentLocale, currentRoute } = useRoutes()

  const route = useMemo(() => {
    if (currentRoute) return currentRoute
    const normalizedPath =
      location.pathname.endsWith('/') && location.pathname.length > 1
        ? location.pathname.slice(0, -1)
        : location.pathname
    return routes?.find?.((r) => {
      const routePath =
        r.path.endsWith('/') && r.path.length > 1 ? r.path.slice(0, -1) : r.path
      return routePath === normalizedPath
    })
  }, [routes, location.pathname, currentRoute])

  const pageTitle = route?.title
  const translatedSiteDescription = getTranslated(
    siteDescription,
    currentLocale,
  )
  const pageDescription = route?.description || translatedSiteDescription || ''

  const translatedSiteTitle = getTranslated(siteTitle, currentLocale)
  const finalTitle = pageTitle
    ? `${pageTitle} | ${translatedSiteTitle}`
    : translatedSiteTitle

  const seo = route?.seo || {}

  const canonicalUrl =
    seo.canonical ||
    (config?.siteUrl && route?.path
      ? `${config.siteUrl.replace(/\/$/, '')}${route.path}`
      : undefined)

  const ogUrl =
    seo['og:url'] ||
    canonicalUrl ||
    (typeof window !== 'undefined' ? window.location.href : undefined)

  // Merge custom global metatags
  const globalMetatags = config?.seo?.metatags || {}

  // Calculate specific ones
  const defaultOgImage = config?.seo?.thumbnails?.background
  const rawOgImage = (seo['og:image'] || route?.coverImage || defaultOgImage) as
    | string
    | undefined

  let ogImage = rawOgImage
  if (ogImage && config?.siteUrl && !/^https?:\/\/|^\/\//.test(ogImage)) {
    const base = config.siteUrl.endsWith('/')
      ? config.siteUrl.slice(0, -1)
      : config.siteUrl
    const path = ogImage.startsWith('/') ? ogImage : `/${ogImage}`
    ogImage = `${base}${path}`
  }

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={pageDescription} />

      {/* Default OG Tags */}
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:type" content="article" />
      {/* Canonical URL for both <link> and og:url */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {ogUrl && <meta property="og:url" content={ogUrl} />}

      {/* Default Twitter Card */}
      <meta
        name="twitter:card"
        content={ogImage ? 'summary_large_image' : 'summary'}
      />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={pageDescription} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}
      {ogImage && <meta property="og:image" content={ogImage} />}

      {/* Generator */}
      <meta name="generator" content="Boltdocs" />

      {/* Search engine verification tags */}
      {config?.seo?.verification?.google && (
        <meta
          name="google-site-verification"
          content={config.seo.verification.google}
        />
      )}
      {config?.seo?.verification?.bing && (
        <meta name="msvalidate.01" content={config.seo.verification.bing} />
      )}
      {config?.seo?.verification?.yandex && (
        <meta
          name="yandex-verification"
          content={config.seo.verification.yandex}
        />
      )}
      {config?.seo?.verification?.pinterest && (
        <meta
          name="p:domain_verify"
          content={config.seo.verification.pinterest}
        />
      )}
      {config?.seo?.verification?.facebook && (
        <meta
          name="facebook-domain-verification"
          content={config.seo.verification.facebook}
        />
      )}

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
          <meta key={key} property={key} content={String(value)} />
        ) : (
          <meta key={key} name={key} content={String(value)} />
        )
      })}

      {/* Page granular SEO tags (override global) */}
      {Object.entries(seo).map(([key, value]) => {
        if (key === 'noindex' && value === true)
          return <meta key="noindex" name="robots" content="noindex" />
        if (key === 'robots')
          return <meta key="robots" name="robots" content={String(value)} />
        if (
          key === 'canonical' ||
          key === 'og:url' ||
          key === 'og:image' ||
          key === 'twitter:image'
        )
          return null // Handled explicitly above

        const isProperty =
          key.startsWith('og:') ||
          key.startsWith('music:') ||
          key.startsWith('video:') ||
          key.startsWith('article:') ||
          key.startsWith('book:') ||
          key.startsWith('profile:')
        return isProperty ? (
          <meta key={key} property={key} content={String(value)} />
        ) : (
          <meta key={key} name={key} content={String(value)} />
        )
      })}
    </Helmet>
  )
}
