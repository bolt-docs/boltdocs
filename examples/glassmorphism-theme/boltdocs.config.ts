import { defineConfig } from 'boltdocs'

export default defineConfig({
  siteUrl: 'https://glassmorphism-demo.boltdocs.com/',
  theme: {
    title: 'Glassmorphism Demo',
    description: 'A stunning glassmorphism theme for Boltdocs',
    logo: {
      light: 'https://boltdocs.vercel.app/logo-light.svg',
      dark: 'https://boltdocs.vercel.app/logo-dark.svg',
      alt: 'Boltdocs Logo',
    },
    navbar: [
      { label: 'Home', href: '/' },
      { label: 'Docs', href: '/docs/getting-started' },
      { label: 'GitHub', href: 'https://github.com/bolt-doc/boltdocs' },
    ],
    sidebar: {
      '/docs/': [
        { text: 'Getting Started', link: '/docs/getting-started' },
        { text: 'Customization', link: '/docs/customization' },
        { text: 'MDX Components', link: '/docs/mdx-components' },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/bolt-doc/boltdocs' },
    ],
    footer: {
      text: 'Built with Boltdocs Glassmorphism Theme',
    },
    codeTheme: {
      light: 'github-light',
      dark: 'tokyo-night',
    },
  },
})
