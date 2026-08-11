import { defineConfig } from 'boltdocs'

export default defineConfig({
  siteUrl: 'https://my-docs.com/',
  theme: {
    title: '{{title}}',
    description: 'Documentation for my project',
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
      {
        label: 'Blog',
        href: '/blog',
      },
    ],
  },
  collections: {
    labels: {
      blog: 'Blog',
    },
    positions: {
      blog: 1,
    },
    postsPerPage: 10,
    defaultCollection: 'blog',
    sortBy: 'date',
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
