import { defineConfig } from 'boltdocs'

export default defineConfig({
  siteUrl: 'https://my-docs.com/',
  i18n: {
    locales: ['en', 'es'],
    localeConfigs: {
      en: {
        label: 'English',
      },
      es: {
        label: 'Spanish',
      },
    },
    defaultLocale: 'en',
  },
  versions: {
    defaultVersion: 'v2.0',
    versions: [
      { label: 'v1.0', path: 'v1.0' },
      { label: 'v2.0', path: 'v2.0' },
    ],
  },
  theme: {
    title: 'i18n-with-versioning',
    description: 'Documentation for my project',
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
    sidebarGroups: {
      'getting-started': {
        title: {
          en: 'Getting Started',
          es: 'Empezando',
        },
        icon: 'Rocket',
      },
    },
    navbar: [
      {
        label: 'Docs',
        href: '/docs/getting-started',
      },
    ],
    // githubRepo: 'bolt-doc/boltdocs',
  },
  robots: {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
  },
})
