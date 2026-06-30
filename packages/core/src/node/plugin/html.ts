import type { BoltdocsConfig } from '../config'
import type { BoltdocsVerificationConfig } from '../../shared/types'
import { escapeHtml } from '../utils'

export function getHtmlTemplate(_config: BoltdocsConfig): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
  favicon: string | undefined
  robotsContent: string | undefined
  customMetaTags: string[]
}

function resolveMeta(config: BoltdocsConfig): ResolvedMeta {
  const defaultLocale = config.i18n?.defaultLocale

  const title = resolveLocaleValue(
    config.theme?.title,
    'Boltdocs',
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
    favicon,
    robotsContent,
    customMetaTags,
  }
}

function buildMetaTags(meta: ResolvedMeta): string {
  const tags = [
    meta.favicon ? `<link rel="icon" href="${escapeHtml(meta.favicon)}">` : '',
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
  // If was not able to find the vercel analytics script, we can skip it
  const { analytics, speedInsights } = vercel
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

function buildPostHogScript(
  posthog: NonNullable<
    NonNullable<BoltdocsConfig['integrations']>['analytics']
  >['posthog'],
  isProd: boolean,
): string {
  if (!posthog || !isProd) return ''

  const safeApiKey = escapeHtml(posthog.apiKey)
  const host = posthog.host || 'https://us.i.posthog.com'
  const safeHost = escapeHtml(host)

  const options: string[] = [`api_host: "${safeHost}"`]
  if (posthog.capturePageview === false) options.push('capture_pageview: false')
  if (posthog.capturePageleave === false)
    options.push('capture_pageleave: false')
  if (posthog.sessionRecording === true)
    options.push('session_recording: { recordCrossOriginPages: true }')
  if (posthog.autocapture === true) options.push('autocapture: true')

  const optionsStr = options.join(', ')

  return `
    <!-- PostHog -->
    <script>
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?(u=e[a]=[]):(a="posthog"),u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init("${safeApiKey}", { ${optionsStr} });
    </script>
`
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
  const posthogScript = buildPostHogScript(
    config.integrations?.analytics?.posthog,
    isProd,
  )

  const headContent = [
    verificationTags,
    preloadLinks,
    metaTags,
    ga4Script,
    vercelScript,
    posthogScript,
    gtm.script,
  ]
    .filter(Boolean)
    .join('\n')

  html = injectThemeScript(html, themeScript)
  html = injectHeadEnd(html, headContent)
  html = injectBodyStart(html, gtm.noScript)
  html = injectEntryScript(html)

  return html
}
