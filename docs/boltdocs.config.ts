import { defineConfig } from 'boltdocs'
import mermaidPlugin from '@bdocs/plugin-mermaid'

export default defineConfig({
  base: '/docs',
  plugins: [mermaidPlugin()],
  siteUrl: 'https://boltdocs.vercel.app/',
  seo: {
    indexing: 'all',
    thumbnails: {
      background: '/og-image.webp',
    },
  },
  theme: {
    title: 'boltdocs',
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
    navbar: [
      {
        label: 'Docs',
        href: '/docs',
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
