import { defineConfig } from 'boltdocs'

export default defineConfig({
  siteUrl: 'https://my-docs.com/',
  theme: {
    title: '{{title}}',
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
