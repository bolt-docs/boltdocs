import path from 'node:path'
import { defineConfig } from 'boltdocs'
import mermaidPlugin from '@bdocs/plugin-mermaid'
import mathPlugin from '@bdocs/plugin-math'
import llmsTextPlugin from '@bdocs/plugin-llms-text'
import rssPlugin from '@bdocs/plugin-rss'
import tailwindcssPlugin from '@bdocs/plugin-tailwindcss'

const rootDir = path.dirname(import.meta.filename)

export default defineConfig({
  base: '/docs',
  aliases: {
    '@': path.resolve(rootDir, 'src'),
  },
  i18n: {
    defaultLocale: 'en',
    locales: { en: 'English', es: 'Español' },
    localeConfigs: {
      es: { label: 'Español', htmlLang: 'es', direction: 'ltr' },
    },
  },
  plugins: [
    tailwindcssPlugin(),
    mathPlugin(),
    llmsTextPlugin(),
    rssPlugin(),
    mermaidPlugin({
      themes: {
        light: {
          primaryColor: '#eef6ff',
          primaryTextColor: '#3d8bfa',
          primaryBorderColor: '#95c0ff',
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
          primaryColor: '#12264d',
          primaryTextColor: '#95c0ff',
          primaryBorderColor: '#2769db',
          lineColor: '#424242',
          mainBkg: '#151515',
          nodeTextColor: '#f1f1f1',
          secondaryColor: '#2a2a2a',
          tertiaryColor: '#151515',
          nodeBorder: '#2a2a2a',
          edgeLabelBackground: '#2a2a2a',
          clusterBkg: '#2a2a2a',
          clusterBorder: '#424242',
        },
      },
    }),
  ],
  siteUrl: 'https://boltdocs.vercel.app/',
  experimental: {
    // View Transitions are kept off for the official docs — the default layout
    // and navigation should behave identically for every visitor.
    viewTransitions: {
      enabled: false,
      types: ['page'],
    },
    // File routing maps literal files in pages-external/ to external routes
    // (e.g. roadmap.mdx → /roadmap). Auxiliary components live in the
    // underscore-prefixed _sections/ folder so they are not treated as routes.
    fileRouting: true,
  },
  seo: {
    indexing: 'all',
    thumbnails: {
      background: '/og-image.webp',
    },
    metatags: {
      keywords:
        'boltdocs, ssg, framework, documentation, guides, integrations, api, plugins, components',
    },
  },
  theme: {
    title: { en: 'Boltdocs', es: 'Boltdocs' },
    description: {
      en: 'Building documentation for your project has never been easier. Create beautiful, highly customizable, and extremely fast sites out of the box.',
      es: 'Crear documentación para tu proyecto nunca ha sido tan fácil. Genera sitios hermosos, altamente personalizables y extremadamente rápidos desde el primer momento.',
    },
    codeTheme: 'github-dark',
    favicon: '/light.svg',
    logo: {
      dark: '/light.svg',
      light: '/dark.svg',
      alt: 'Boltdocs Logo',
    },
    tabs: [
      { id: 'guides', text: { en: 'Guides', es: 'Guías' } },
      { id: 'integrations', text: { en: 'Integrations', es: 'Integraciones' } },
      { id: 'api', text: 'API' },
      { id: 'plugins', text: { en: 'Plugins', es: 'Plugins' } },
      { id: 'components', text: { en: 'Components', es: 'Componentes' } },
      { id: 'releases', text: { en: 'Releases', es: 'Lanzamientos' } },
    ],
    navbar: [
      {
        label: { en: 'Docs', es: 'Docs' },
        href: '/docs',
        items: [
          {
            label: { en: 'Guides', es: 'Guías' },
            href: '/docs/guides',
          },
          {
            label: { en: 'Installation', es: 'Instalación' },
            href: '/docs/guides/getting-started/installation',
          },
          {
            label: { en: 'Configuration', es: 'Configuración' },
            href: '/docs/guides/getting-started/configuration',
          },
        ],
      },
      {
        label: 'Showcase',
        href: 'site:/showcase',
      },
      {
        label: { en: 'Roadmap', es: 'Roadmap' },
        href: 'site:/roadmap',
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
    analytics: {
      vercel: {
        analytics: true,
        speedInsights: true,
      },
    },
    feedback: {
      custom: {
        enabled: true,
        owner: 'bolt-docs',
        repo: 'boltdocs',
      },
    },
  },
})
