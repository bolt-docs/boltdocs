import type { BoltdocsConfig } from '../config'

/**
 * Provides a default HTML template if none is found in the project root.
 */
export function getHtmlTemplate(config: BoltdocsConfig): string {
  const title = config.theme?.title || 'Boltdocs'
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`
}

/**
 * Injects OpenGraph, Twitter, and generic SEO meta tags into the final HTML output.
 * Also ensures the virtual entry file is injected if it's missing (e.g., standard Vite index.html).
 *
 * @param html - {string} The original HTML string
 * @param config - {BoltdocsConfig} The resolved Boltdocs configuration containing site metadata
 * @returns {string} The modified HTML string with injected tags
 */
export function injectHtmlMeta(html: string, config: BoltdocsConfig): string {
  // If the input HTML is empty or invalid, start with the default template
  if (!html || !html.includes('<body') || !html.includes('<head')) {
    html = getHtmlTemplate(config)
  }

  const theme = config.theme
  let title = theme?.title || 'Boltdocs'
  if (typeof title === 'object') {
    const defaultLocale = config.i18n?.defaultLocale || ''
    title = title[defaultLocale] || Object.values(title)[0] || 'Boltdocs'
  }
  let description = theme?.description || ''
  if (typeof description === 'object') {
    const defaultLocale = config.i18n?.defaultLocale || ''
    description =
      description[defaultLocale] || Object.values(description)[0] || ''
  }

  // Determine favicon
  let favicon = theme?.favicon
  if (!favicon && theme?.logo) {
    if (typeof theme.logo === 'string') {
      favicon = theme.logo
    } else {
      favicon = theme.logo.light || theme.logo.dark
    }
  }

  // Resolve OG image from config.seo.thumbnails
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

  // Build custom metatags from config.seo.metatags
  const globalMetatags = config.seo?.metatags || {}
  const customMetaTags = Object.entries(globalMetatags).map(([key, value]) => {
    const isProperty =
      key.startsWith('og:') ||
      key.startsWith('music:') ||
      key.startsWith('video:') ||
      key.startsWith('article:') ||
      key.startsWith('book:') ||
      key.startsWith('profile:')
    return isProperty
      ? `<meta property="${key}" content="${value}">`
      : `<meta name="${key}" content="${value}">`
  })

  // robots from config.seo.indexing
  const robotsContent =
    config.seo?.indexing === 'none'
      ? 'noindex, nofollow'
      : config.seo?.indexing === 'all'
        ? undefined
        : config.seo?.indexing

  const seoTags = [
    favicon ? `<link rel="icon" href="${favicon}">` : '',
    `<meta name="description" content="${description}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:type" content="website">`,
    config.siteUrl
      ? `<meta property="og:url" content="${config.siteUrl}">`
      : '',
    config.siteUrl ? `<link rel="canonical" href="${config.siteUrl}">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    ogImage ? `<meta property="og:image" content="${ogImage}">` : '',
    ogImage ? `<meta name="twitter:image" content="${ogImage}">` : '',
    robotsContent ? `<meta name="robots" content="${robotsContent}">` : '',
    `<meta name="generator" content="Boltdocs">`,
    ...customMetaTags,
  ]
    .filter(Boolean)
    .join('\n    ')

  const themeScript = `
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
          // Ignore localStorage errors (e.g. if cookies/storage are disabled)
        }
      })();
    </script>
  `

  // Use regex to replace title or inject it if missing
  if (html.includes('<title>')) {
    html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
  } else {
    html = html.replace('</head>', `  <title>${title}</title>\n  </head>`)
  }

  let ga4Script = ''
  if (config.integrations?.ga4) {
    const ga4 = config.integrations.ga4
    const isProd = process.env.NODE_ENV === 'production'
    if (isProd || ga4.debug) {
      const ipAnonymization = ga4.anonymizeIp ? `gtag('set', 'ip', true);` : ''
      const sendPageView =
        ga4.sendPageView === false ? '{send_page_view: false}' : '{}'
      const cookieFlags = ga4.cookieFlags
        ? `, {'cookie_flags': '${ga4.cookieFlags}'}`
        : ''

      ga4Script = `
    <!-- Google tag (gtag.js) - ${ga4.measurementId} -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${ga4.measurementId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      ${ipAnonymization}
      gtag('config', '${ga4.measurementId}', ${sendPageView}${cookieFlags});
    </script>
`
    }
  }

  let gtmScript = ''
  let gtmNoScript = ''
  if (config.integrations?.gtm) {
    const gtm = config.integrations.gtm
    const isProd = process.env.NODE_ENV === 'production'
    if (isProd) {
      const dataLayerName = gtm.dataLayerName || 'dataLayer'
      const previewParam = gtm.preview ? `&gtm_preview=${gtm.preview}` : ''

      gtmScript = `
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='${dataLayerName}'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl+'${previewParam}';f.parentNode.insertBefore(j,f);
    })(window,document,'script','${dataLayerName}','${gtm.tagId}');</script>
    <!-- End Google Tag Manager -->
`
      gtmNoScript = `
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtm.tagId}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
`
    }
  }

  html = html.replace('<head>', `<head>\n${themeScript}`)

  html = html.replace(
    '</head>',
    `    ${seoTags}\n${ga4Script}${gtmScript}  </head>`,
  )

  if (gtmNoScript) {
    html = html.replace(/<body([^>]*)>/, `<body$1>\n${gtmNoScript}`)
  }

  if (!html.includes('src/main') && !html.includes('virtual:boltdocs-entry')) {
    html = html.replace(
      '</body>',
      '  <script type="module">import "virtual:boltdocs-entry";</script>\n  </body>',
    )
  }

  return html
}
