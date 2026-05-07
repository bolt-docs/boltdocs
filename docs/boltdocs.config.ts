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
    breadcrumbs: true,
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
        href: '/docs/guides/overview/introduction',
      },
      {
        label: 'API',
        href: '/docs/api/hooks/use-routes',
      },
      {
        label: 'Components',
        href: '/docs/components/overview',
      },
      {
        label: 'Roadmap',
        href: '/roadmap',
      },
    ],
    sidebarGroups: {
      overview: {
        icon: 'BookOpen',
      },
      'core-concepts': {
        icon: 'Rocket',
      },
      customization: {
        icon: 'Settings',
      },
      performance: {
        icon: 'Zap',
      },
      integrations: {
        icon: 'PlugZap',
      },
    },
    editLink:
      'https://github.com/jesusalcaladev/boltdocs/edit/main/docs/docs/:path',
    githubRepo: 'jesusalcaladev/boltdocs',
    tabs: [
      { id: 'guides', text: 'Guides', icon: 'SquareLibrary' },
      { id: 'api', text: 'API', icon: 'Braces' },
      { id: 'primitives', text: 'Primitives', icon: 'Boxes' },
      { id: 'components', text: 'Components', icon: 'Component' },
      { id: 'plugins', text: 'Plugins', icon: 'Plug' },
    ],
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
