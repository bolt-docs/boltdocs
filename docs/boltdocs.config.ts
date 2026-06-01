import { defineConfig } from 'boltdocs'
import mermaidPlugin from '@bdocs/plugin-mermaid'

export default defineConfig({
  base: '/docs',
  plugins: [
    mermaidPlugin({
      themes: {
        light: {
          primaryColor: '#fef4f0',
          primaryTextColor: '#eb5828',
          primaryBorderColor: '#faa184',
          lineColor: '#b5b19c',
          mainBkg: '#ffffff',
          nodeTextColor: '#25241d',
          secondaryColor: '#f5f4ee',
          tertiaryColor: '#ffffff',
          nodeBorder: '#eae8de',
          edgeLabelBackground: '#faf9f5',
          clusterBkg: '#f5f4ee',
          clusterBorder: '#d9d6c7',
        },
        dark: {
          primaryColor: '#5a1503',
          primaryTextColor: '#faa184',
          primaryBorderColor: '#d34013',
          lineColor: '#767673',
          mainBkg: '#1e1e1d',
          nodeTextColor: '#d5d5d3',
          secondaryColor: '#252524',
          tertiaryColor: '#141413',
          nodeBorder: '#3c3c39',
          edgeLabelBackground: '#252524',
          clusterBkg: '#252524',
          clusterBorder: '#3c3c39',
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
      { id: 'guides', text: 'Guides' },
      { id: 'integrations', text: 'Integrations' },
      { id: 'api', text: 'API' },
      { id: 'plugins', text: 'Plugins' },
      { id: 'components', text: 'Components' },
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
            href: '/docs/guides/getting-started/installation',
          },
          {
            label: ' Configuration',
            href: '/docs/guides/getting-started/configuration',
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
