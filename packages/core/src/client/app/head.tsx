import { useMemo } from 'react'
import { useLocation } from '../router'
import { Helmet } from './helmet-compat'
import { useConfig } from './config-context'
import { getTranslated } from '../utils/i18n'
import { useRoutes } from '../hooks/use-routes'
import { resolvePublicAssetUrl } from '../utils/path'
import { StructuredData } from '../components/structured-data'
import type { StructuredData as StructuredDataValue } from '../../shared/types'

function stringifyMetaValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (Array.isArray(value)) return value.map(stringifyMetaValue).join(', ')
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const namedValue = record.name ?? record.value ?? record.url
    if (namedValue !== undefined) return stringifyMetaValue(namedValue)
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value)
}

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
      if (!r?.path) return false
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
  const structuredData = [
    ...(Array.isArray(config?.seo?.structuredData)
      ? config.seo.structuredData
      : config?.seo?.structuredData
        ? [config.seo.structuredData]
        : []),
    ...(Array.isArray(seo.structuredData)
      ? seo.structuredData
      : seo.structuredData
        ? [seo.structuredData]
        : []),
  ] as StructuredDataValue[]

  const canonicalValue = stringifyMetaValue(seo.canonical)
  const canonicalUrl =
    canonicalValue ||
    (config?.siteUrl && route?.path
      ? `${config.siteUrl.replace(/\/$/, '')}${route.path}`
      : undefined)

  const ogUrl =
    stringifyMetaValue(seo['og:url']) ||
    canonicalUrl ||
    (typeof window !== 'undefined' ? window.location.href : undefined)

  // Calculate specific ones
  const defaultOgImage = config?.seo?.thumbnails?.background
  const rawOgImage =
    stringifyMetaValue(seo['og:image']) || route?.coverImage || defaultOgImage

  let ogImage = rawOgImage
  if (ogImage && !/^https?:\/\/|^\/\//.test(ogImage)) {
    const assetPath = resolvePublicAssetUrl(
      ogImage.startsWith('/') ? ogImage : `/${ogImage}`,
      config.base,
    )
    if (config?.siteUrl) {
      const siteBase = config.siteUrl.replace(/\/$/, '')
      ogImage = `${siteBase}${assetPath}`
    } else {
      ogImage = assetPath
    }
  }

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={pageDescription} />
      {structuredData.map((data) => (
        <StructuredData key={JSON.stringify(data)} data={data} />
      ))}

      {/* Default OG Tags */}
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:type" content="article" />
      {/* Canonical URL for both <link> and og:url */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl as string} />}
      {ogUrl && <meta property="og:url" content={ogUrl as string} />}

      {/* Default Twitter Card */}
      <meta
        name="twitter:card"
        content={ogImage ? 'summary_large_image' : 'summary'}
      />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={pageDescription} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}
      {ogImage && <meta property="og:image" content={ogImage} />}

      {/* Page granular SEO tags (override global) */}
      {Object.entries(seo).map(([key, value]) => {
        if (key === 'noindex' && value === true)
          return <meta key="noindex" name="robots" content="noindex" />
        if (key === 'robots')
          return (
            <meta
              key="robots"
              name="robots"
              content={stringifyMetaValue(value)}
            />
          )
        if (
          key === 'canonical' ||
          key === 'og:url' ||
          key === 'og:image' ||
          key === 'twitter:image' ||
          key === 'structuredData'
        )
          return null // Handled explicitly above

        const isProperty =
          key.startsWith('og:') ||
          key.startsWith('music:') ||
          key.startsWith('video:') ||
          key.startsWith('article:') ||
          key.startsWith('book:') ||
          key.startsWith('profile:')
        const strVal = stringifyMetaValue(value)
        return isProperty ? (
          <meta key={key} property={key} content={strVal} />
        ) : (
          <meta key={key} name={key} content={strVal} />
        )
      })}
    </Helmet>
  )
}
