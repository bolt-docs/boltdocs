import { defineConfig } from 'boltdocs'

export default defineConfig({
  base: '/',
  theme: {
    title: 'Minimal Fixture',
    tabs: [{ id: 'docs', text: 'Docs' }],
    navbar: [
      {
        label: 'Docs',
        href: '/docs',
        items: [
          { label: 'Home', href: '/docs' },
          { label: 'Next Page', href: '/docs/page' },
        ],
      },
    ],
  },
})
