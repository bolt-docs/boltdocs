import { defineConfig } from 'boltdocs'
import mermaidPlugin from '@bdocs/plugin-mermaid'
import mathPlugin from '@bdocs/plugin-math'

export default defineConfig({
  base: '/docs',
  i18n: {
    defaultLocale: 'en',
    locales: { en: 'English', es: 'Español' },
    localeConfigs: {
      es: { label: 'Español', htmlLang: 'es', direction: 'ltr' },
    },
  },
  plugins: [
    mathPlugin(),
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
      { id: 'guides', text: { en: 'Guides', es: 'Guías' } },
      { id: 'integrations', text: { en: 'Integrations', es: 'Integraciones' } },
      { id: 'api', text: 'API' },
      { id: 'plugins', text: { en: 'Plugins', es: 'Plugins' } },
      { id: 'components', text: { en: 'Components', es: 'Componentes' } },
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
        href: '/showcase',
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
      ga4: {
        measurementId: 'G-WRBYHMBDYQ',
      },
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
