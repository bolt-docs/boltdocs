import type { BoltdocsConfig } from '../config'
import type { BoltdocsVerificationConfig } from '../../shared/types'
import { escapeHtml } from '../utils'

export function getHtmlTemplate(config: BoltdocsConfig): string {
  const rawTitle = config.theme?.title
  const title =
    typeof rawTitle === 'string'
      ? rawTitle
      : rawTitle
        ? Object.values(rawTitle)[0] || 'Boltdocs'
        : 'Boltdocs'
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`
}

function resolveLocaleValue(
  value: string | Record<string, string> | undefined,
  fallback: string,
  defaultLocale?: string,
): string {
  if (!value) return fallback
  if (typeof value === 'string') return value
  return value[defaultLocale || ''] || Object.values(value)[0] || fallback
}

interface ResolvedMeta {
  title: string
  description: string
  favicon: string | undefined
  ogImage: string | undefined
  robotsContent: string | undefined
  siteUrl: string | undefined
  customMetaTags: string[]
}

function resolveMeta(config: BoltdocsConfig): ResolvedMeta {
  const defaultLocale = config.i18n?.defaultLocale

  const title = resolveLocaleValue(
    config.theme?.title,
    'Boltdocs',
    defaultLocale,
  )
  const description = resolveLocaleValue(
    config.theme?.description,
    '',
    defaultLocale,
  )

  let favicon = config.theme?.favicon
  if (!favicon && config.theme?.logo) {
    if (typeof config.theme.logo === 'string') {
      favicon = config.theme.logo
    } else {
      favicon = config.theme.logo.light || config.theme.logo.dark
    }
  }

  let ogImage: string | undefined
  const rawOgImage = config.seo?.thumbnails?.background
  if (rawOgImage && config.siteUrl && !/^https?:\/\/|^\/\//.test(rawOgImage)) {
    const base = config.siteUrl.endsWith('/')
      ? config.siteUrl.slice(0, -1)
      : config.siteUrl
    const path = rawOgImage.startsWith('/') ? rawOgImage : `/${rawOgImage}`
    ogImage = `${base}${path}`
  } else if (rawOgImage) {
    ogImage = rawOgImage
  }

  const robotsContent =
    config.seo?.indexing === 'none'
      ? 'noindex, nofollow'
      : config.seo?.indexing === 'all'
        ? undefined
        : config.seo?.indexing

  const globalMetatags = config.seo?.metatags || {}
  const customMetaTags = Object.entries(globalMetatags).map(([key, value]) => {
    const safeKey = escapeHtml(key)
    const safeValue = escapeHtml(value)
    const isProperty =
      key.startsWith('og:') ||
      key.startsWith('music:') ||
      key.startsWith('video:') ||
      key.startsWith('article:') ||
      key.startsWith('book:') ||
      key.startsWith('profile:')
    return isProperty
      ? `<meta property="${safeKey}" content="${safeValue}">`
      : `<meta name="${safeKey}" content="${safeValue}">`
  })

  return {
    title,
    description,
    favicon,
    ogImage,
    robotsContent,
    siteUrl: config.siteUrl,
    customMetaTags,
  }
}

function buildMetaTags(meta: ResolvedMeta): string {
  const tags = [
    meta.favicon ? `<link rel="icon" href="${escapeHtml(meta.favicon)}">` : '',
    `<meta name="description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:type" content="website">`,
    meta.siteUrl
      ? `<meta property="og:url" content="${escapeHtml(meta.siteUrl)}">`
      : '',
    meta.siteUrl
      ? `<link rel="canonical" href="${escapeHtml(meta.siteUrl)}">`
      : '',
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}">`,
    meta.ogImage
      ? `<meta property="og:image" content="${escapeHtml(meta.ogImage)}">`
      : '',
    meta.ogImage
      ? `<meta name="twitter:image" content="${escapeHtml(meta.ogImage)}">`
      : '',
    meta.robotsContent
      ? `<meta name="robots" content="${escapeHtml(meta.robotsContent)}">`
      : '',
    `<meta name="generator" content="Boltdocs">`,
    ...meta.customMetaTags,
  ]
    .filter(Boolean)
    .join('\n    ')

  return tags
}

function buildVerificationTags(
  verification: BoltdocsVerificationConfig | undefined,
): string {
  if (!verification) return ''
  const tags: string[] = []
  if (verification.google)
    tags.push(
      `<meta name="google-site-verification" content="${escapeHtml(verification.google)}">`,
    )
  if (verification.bing)
    tags.push(
      `<meta name="msvalidate.01" content="${escapeHtml(verification.bing)}">`,
    )
  if (verification.yandex)
    tags.push(
      `<meta name="yandex-verification" content="${escapeHtml(verification.yandex)}">`,
    )
  if (verification.pinterest)
    tags.push(
      `<meta name="p:domain_verify" content="${escapeHtml(verification.pinterest)}">`,
    )
  if (verification.facebook)
    tags.push(
      `<meta name="facebook-domain-verification" content="${escapeHtml(verification.facebook)}">`,
    )
  return tags.join('\n    ')
}

function buildPreloadLinks(config: BoltdocsConfig): string {
  const links: string[] = []

  // Preload logo image if configured (above-the-fold critical resource)
  const logo = config.theme?.logo
  let logoSrc: string | undefined
  if (typeof logo === 'string') {
    logoSrc = logo
  } else if (logo && typeof logo === 'object') {
    logoSrc = logo.light || logo.dark
  }

  if (logoSrc) {
    // Determine image type from extension
    const ext = logoSrc.split('.').pop()?.toLowerCase()
    const typeMap: Record<string, string> = {
      webp: 'image/webp',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      svg: 'image/svg+xml',
      avif: 'image/avif',
    }
    const type = typeMap[ext || ''] || 'image/png'
    links.push(
      `<link rel="preload" as="image" href="${logoSrc}" type="${type}" fetchpriority="high">`,
    )
  }

  return links.join('\n    ')
}

function buildThemeScript(): string {
  return `
    <script>
      (function() {
        try {
          var stored = localStorage.getItem("boltdocs-theme");
          var isDark =
            stored === "dark" ||
            (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
          document.documentElement.classList.toggle("dark", isDark);
          document.documentElement.dataset.theme = isDark ? "dark" : "light";
        } catch (e) {
        }
      })();
    </script>
  `
}

function buildGa4Script(
  ga4: NonNullable<
    NonNullable<BoltdocsConfig['integrations']>['analytics']
  >['ga4'],
  isProd: boolean,
): string {
  if (!ga4) return ''
  if (!isProd && !ga4.debug) return ''

  const ipAnonymization = ga4.anonymizeIp ? `gtag('set', 'ip', true);` : ''
  const sendPageView =
    ga4.sendPageView === false ? '{send_page_view: false}' : '{}'
  const cookieFlags = ga4.cookieFlags
    ? `, {'cookie_flags': '${ga4.cookieFlags}'}`
    : ''

  const safeId = escapeHtml(ga4.measurementId)
  return `
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${safeId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      ${ipAnonymization}
      gtag('config', '${safeId}', ${sendPageView}${cookieFlags});
    </script>
`
}

function buildGtmScript(
  gtm: NonNullable<
    NonNullable<BoltdocsConfig['integrations']>['analytics']
  >['gtm'],
  isProd: boolean,
): { script: string; noScript: string } {
  if (!gtm || !isProd) return { script: '', noScript: '' }

  const dataLayerName = escapeHtml(gtm.dataLayerName || 'dataLayer')
  const previewParam = gtm.preview
    ? `&gtm_preview=${escapeHtml(gtm.preview)}`
    : ''
  const safeTagId = escapeHtml(gtm.tagId)

  // Use defer instead of async to load after paint for better performance
  const script = `
    <!-- Google Tag Manager -->
    <script defer>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='${dataLayerName}'?'&l='+l:'';j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl+'${previewParam}';f.parentNode.insertBefore(j,f);
    })(window,document,'script','${dataLayerName}','${safeTagId}');</script>
    <!-- End Google Tag Manager -->
`

  const noScript = `
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${safeTagId}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
`

  return { script, noScript }
}

function buildVercelScript(
  vercel: NonNullable<
    NonNullable<BoltdocsConfig['integrations']>['analytics']
  >['vercel'],
  isProd: boolean,
): string {
  if (!vercel || !isProd) return ''

  const { analytics = true, speedInsights = true } = vercel
  let script = ''

  if (analytics) {
    script += `
    <script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>
    <script defer src="/_vercel/insights/script.js"></script>
`
  }
  if (speedInsights) {
    script += `
    <script>window.si=window.si||function(){(window.siq=window.siq||[]).push(arguments)};</script>
    <script defer src="/_vercel/speed-insights/script.js"></script>
`
  }

  return script
}

function injectTitle(html: string, title: string): string {
  const safeTitle = escapeHtml(title)
  if (html.includes('<title>')) {
    return html.replace(/<title>.*?<\/title>/, `<title>${safeTitle}</title>`)
  }
  return html.replace('</head>', `  <title>${safeTitle}</title>\n  </head>`)
}

function injectThemeScript(html: string, themeScript: string): string {
  return html.replace('<head>', `<head>\n${themeScript}`)
}

function injectHeadEnd(html: string, headContent: string): string {
  return html.replace('</head>', `    ${headContent}</head>`)
}

function injectBodyStart(html: string, content: string): string {
  if (!content) return html
  return html.replace(/<body([^>]*)>/, `<body$1>\n${content}`)
}

function injectEntryScript(html: string): string {
  if (html.includes('src/main') || html.includes('virtual:boltdocs-entry')) {
    return html
  }
  return html.replace(
    '</body>',
    '  <script type="module">import "virtual:boltdocs-entry";</script>\n  </body>',
  )
}

export function injectHtmlMeta(html: string, config: BoltdocsConfig): string {
  if (!html || !html.includes('<body') || !html.includes('<head')) {
    html = getHtmlTemplate(config)
  }

  const isProd = process.env.NODE_ENV === 'production'
  const meta = resolveMeta(config)

  const metaTags = buildMetaTags(meta)
  const verificationTags = buildVerificationTags(config.seo?.verification)
  const preloadLinks = buildPreloadLinks(config)
  const themeScript = buildThemeScript()
  const ga4Script = buildGa4Script(config.integrations?.analytics?.ga4, isProd)
  const gtm = buildGtmScript(config.integrations?.analytics?.gtm, isProd)
  const vercelScript = buildVercelScript(
    config.integrations?.analytics?.vercel,
    isProd,
  )

  const headContent = [
    verificationTags,
    preloadLinks,
    metaTags,
    ga4Script,
    vercelScript,
    gtm.script,
  ]
    .filter(Boolean)
    .join('\n')

  html = injectTitle(html, meta.title)
  html = injectThemeScript(html, themeScript)
  html = injectHeadEnd(html, headContent)
  html = injectBodyStart(html, gtm.noScript)
  html = injectEntryScript(html)

  return html
}
