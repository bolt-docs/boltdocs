import { defineConfig } from 'boltdocs'
import tailwindcssPlugin from '@bdocs/plugin-tailwindcss'

export default defineConfig({
  plugins: [tailwindcssPlugin()],
  siteUrl: 'https://my-docs.com/',
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
  },
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
    ],
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
