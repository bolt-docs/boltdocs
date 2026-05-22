import { defineConfig } from 'boltdocs'
import mermaidPlugin from '@bdocs/plugin-mermaid'

export default defineConfig({
  base: '/docs',
  plugins: [
    mermaidPlugin({
      themes: {
        light: {
          primaryColor: '#e0f2fe',
          primaryTextColor: '#0c4a6e',
          primaryBorderColor: '#38bdf8',
          lineColor: '#64748b',
          mainBkg: '#ffffff',
          nodeTextColor: '#0f172a',
          secondaryColor: '#f0f9ff',
          tertiaryColor: '#ffffff',
          nodeBorder: '#bae6fd',
          edgeLabelBackground: '#f0f9ff',
          clusterBkg: '#f0f9ff',
          clusterBorder: '#bae6fd',
        },
        dark: {
          primaryColor: '#0c4a6e',
          primaryTextColor: '#e0f2fe',
          primaryBorderColor: '#38bdf8',
          lineColor: '#94a3b8',
          mainBkg: '#0f172a',
          nodeTextColor: '#e2e8f0',
          secondaryColor: '#0c4a6e',
          tertiaryColor: '#1e293b',
          nodeBorder: '#164e63',
          edgeLabelBackground: '#0c4a6e',
          clusterBkg: '#0c4a6e',
          clusterBorder: '#164e63',
        },
      },
    }),
  ],
  siteUrl: 'https://boltdocs.vercel.app/',
  seo: {
    indexing: 'all',
    thumbnails: {
      background: '/og-image.webp',
    },
  },
  theme: {
    title: 'Boltdocs',
    description:
      'Building documentation for your project has never been easier, with boltdocs you can create beautiful documentation, 80% customizable, with 15+ components.',
    codeTheme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    favicon: '/light.svg',
    logo: {
      dark: '/light.svg',
      light: '/dark.svg',
      alt: 'Boltdocs Logo',
    },
    tabs: [
      { id: 'guides', text: 'Guides', },
      { id: 'integrations', text: 'Integrations', },
      { id: 'api', text: 'API', },
      { id: 'plugins', text: 'Plugins', },
      { id: 'components', text: 'Components', },
    ],
    navbar: [
      {
        label: 'Docs',
        href: '/docs',
        items: [
          {
            label: 'Guides',
            href: '/docs/guides',
          },
          {
            label: 'Installation',
            href: '/docs/guides/installation',
          },
          {
            label: ' Configuration',
            href: '/docs/guides/configuration',
          },
        ],
      },
    ],
    editLink:
      'https://github.com/jesusalcaladev/boltdocs/edit/main/docs/docs/:path',
    githubRepo: 'jesusalcaladev/boltdocs',
  },
  robots: {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemaps: ['https://boltdocs.vercel.app/sitemap.xml'],
  },
  integrations: {
    ga4: {
      measurementId: 'G-WRBYHMBDYQ',
    },
  },
})
