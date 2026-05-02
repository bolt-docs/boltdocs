import type { Plugin as VitePlugin } from 'vite'
import type { BoltdocsConfig } from 'boltdocs/node/config'
import type { SecureBoltdocsPlugin } from 'boltdocs/node/plugins'

export interface BoltdocsAnalyticsPluginConfig {
  ga4?: {
    measurementId: string
    debug?: boolean
    anonymizeIp?: boolean
    sendPageView?: boolean
    cookieFlags?: string
  }
  gtm?: {
    tagId: string
    dataLayerName?: string
    preview?: string
  }
}

export interface AnalyticsVitePluginOptions {
  config: BoltdocsAnalyticsPluginConfig
}

export function analyticsPlugin(
  options: AnalyticsVitePluginOptions,
): SecureBoltdocsPlugin {
  const { config } = options

  return {
    name: 'boltdocs-plugin-analytics',
    version: '0.1.0',
    permissions: ['vite:config'],
    vitePlugins: [
      analyticsVitePlugin(options),
    ],
  }
}

function analyticsVitePlugin(
  options: AnalyticsVitePluginOptions,
): VitePlugin {
  const { config } = options

  return {
    name: 'vite-plugin-boltdocs-analytics',
    enforce: 'pre',

    config() {
      return {
        define: {
          __BOLTDOCS_GA4_MEASUREMENT_ID__: JSON.stringify(config.ga4?.measurementId || null),
          __BOLTDOCS_GTM_TAG_ID__: JSON.stringify(config.gtm?.tagId || null),
          __BOLTDOCS_ANALYTICS_DEBUG__: String(config.ga4?.debug ?? false),
          __BOLTDOCS_ANALYTICS_DATA_LAYER_NAME__: JSON.stringify(
            config.gtm?.dataLayerName || 'dataLayer',
          ),
        },
      }
    },

    transformIndexHtml(html) {
      const isProd = process.env.NODE_ENV === 'production'
      const scripts: string[] = []

      if (config.ga4) {
        const ga4 = config.ga4
        if (isProd || ga4.debug) {
          const ipAnonymization = ga4.anonymizeIp
            ? `gtag('set', 'ip', true);`
            : ''

          scripts.push(`
    <!-- Google tag (gtag.js) - ${ga4.measurementId} -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${ga4.measurementId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      ${ipAnonymization}
      gtag('config', '${ga4.measurementId}', ${
  ga4.sendPageView === false
    ? '{send_page_view: false}'
    : '{}'
}${
  ga4.cookieFlags
    ? `, {'cookie_flags': '${ga4.cookieFlags}'}`
    : ''
});
    </script>
`)
        }
      }

      if (config.gtm) {
        const gtm = config.gtm
        if (isProd) {
          const dataLayerName = gtm.dataLayerName || 'dataLayer'
          const previewParam = gtm.preview ? `&gtm_preview=${gtm.preview}` : ''

          scripts.push(`
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='${dataLayerName}'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl+'${previewParam}';f.parentNode.insertBefore(j,f);
    })(window,document,'script','${dataLayerName}','${gtm.tagId}');</script>
    <!-- End Google Tag Manager -->
`)
        }
      }

      if (scripts.length > 0) {
        html = html.replace('</head>', `    ${scripts.join('\n    ')}\n  </head>`)
      }

      if (config.gtm && isProd) {
        const gtm = config.gtm
        const dataLayerName = gtm.dataLayerName || 'dataLayer'
        html = html.replace(
          '<body',
          `<body>\n    <!-- Google Tag Manager (noscript) -->\n    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtm.tagId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n    <!-- End Google Tag Manager (noscript) -->`,
        )
      }

      return html
    },
  }
}

export default analyticsPlugin