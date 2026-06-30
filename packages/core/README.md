<h1 align="center">Boltdocs</h1>

<p align="center">
  <strong>A modern documentation framework built with React, Vite, and MDX.</strong>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://img.shields.io/badge/Quick_Start-blue?style=flat-square" alt="Quick Start" /></a>
  <a href="https://boltdocs.vercel.app"><img src="https://img.shields.io/badge/Live_Demo-purple?style=flat-square" alt="Live Demo" /></a>
  <br />
  <a href="https://www.npmjs.com/package/boltdocs"><img src="https://img.shields.io/npm/v/boltdocs?style=flat-square" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/boltdocs"><img src="https://img.shields.io/npm/dm/boltdocs?style=flat-square" alt="npm downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License" /></a>
  <a href="https://github.com/bolt-docs/boltdocs"><img src="https://img.shields.io/github/stars/bolt-docs/boltdocs?style=flat-square" alt="GitHub stars" /></a>
  <a href="https://github.com/bolt-docs/boltdocs/pulls"><img src="https://img.shields.io/badge/PRs-welcome-blue.svg?style=flat-square" alt="PRs Welcome" /></a>
</p>

---

## Quick Start

```bash
pnpx create-boltdocs@latest my-docs
cd my-docs
pnpm dev
```

Or add to an existing project:

```bash
pnpm add boltdocs
mkdir docs && echo "# Hello World" > docs/index.md
```

---

## Why Boltdocs?

**Zero config, instant docs.** A single command sets up a full documentation site with Tailwind CSS v4, TypeScript, MDX support, and a production-ready layout — zero boilerplate.

**Built-in, not bolt-on.** i18n, versioning, full-text search, SEO, analytics (GA4/GTM), syntax highlighting (Shiki), image optimization, CSP headers, and a changelog generator — all ship as part of the framework, not as third-party plugins.

**React 19 + Vite 8 + Tailwind v4.** Built on the latest ecosystem versions. No legacy abstractions, no stale dependencies — just the modern React stack.

---

## Features

### ⚡ Performance

- **Vite-powered dev server** with instant HMR — edit MDX files and see changes in under 100ms
- **Static Site Generation (SSG)** via `@bdocs/ssg` — pre-renders every page at build time with React Router's `createStaticHandler`
- **Shiki syntax highlighting at build time** — zero client-side cost for code blocks. 7 themes: `github-dark`, `github-light`, `tokyo-night`, `dracula`, `nord`, `one-dark-pro`, `one-light`
- **Image optimization** — automatic compression via `sharp` and `svgo` during the build
- **Incremental builds** — only re-build pages that changed (Turborepo-powered caching)

### 🧩 MDX Components

15+ built-in components, importable from `boltdocs/mdx`:

```mdx
import { Callout, Card, Cards, CodeBlock } from 'boltdocs/mdx'

<Callout type="tip" title="Pro tip">
  This is a tip callout with an icon and a custom title.
</Callout>

<Cards>
  <Card title="Getting Started" href="/docs/guides" icon="rocket" />
  <Card title="API Reference" href="/docs/api" icon="code" />
  <Card title="Components" href="/docs/components" icon="puzzle" />
</Cards>
```

Includes: `Callout`, `Card`, `Cards`, `CodeBlock`, `Field`, `Table`, `Image`, and enhanced typography components.

### 🌍 Internationalization & Versioning

- **Multi-locale** — define locales with labels, RTL direction, custom HTML lang, and calendar settings
- **Fallback logic** — automatically falls back to the default locale for untranslated pages
- **Versioned docs** — support for multiple documentation versions with URL prefixes (e.g., `/docs/v2.0/`)
- **Generated TypeScript types** — strict locale and version type safety

### 🔍 Search & SEO

- **Full-text search** — client-side via FlexSearch with debounced UI, keyboard shortcut (`Cmd+K`), and result highlighting
- **Auto-generated sitemap.xml and robots.txt** — configurable rules and multiple sitemap support
- **OpenGraph thumbnails** — automatic OG image generation
- **Meta tag injection** — configurable SEO meta tags per page or globally
- **Canonical URL management** — automatic canonical URL handling for versioned and localized routes

### 🔒 Security & Analytics

- **Content-Security-Policy** — CSP header generation with configurable directives
- **Custom security headers** — fine-grained HTTP header control
- **Google Analytics 4** — built-in GA4 integration with auto-tracking for page views, search, downloads, and external links
- **Google Tag Manager** — GTM support with data layer pushes

### 🩺 Documentation Health (Doctor)

```bash
boltdocs doctor          # Check for broken links, missing metadata, orphaned translations
boltdocs doctor --fix    # Auto-fix broken internal links
boltdocs doctor --check-external  # Verify external links too
```

- **Broken internal link detection** — finds links pointing to non-existent files
- **Missing metadata warnings** — flags pages without titles in frontmatter
- **Orphaned translation detection** — identifies missing locale counterparts
- **Performance budgets** — `boltdocs doctor --budget` checks JS/CSS/HTML size, image assets, and build time against configurable thresholds in `doctor.json`

### 🔌 Plugin System

Extend Boltdocs with plugins that hook into remark, rehype, Vite, and component registration:

```bash
pnpm add @bdocs/plugin-mermaid
```

```ts
// boltdocs.config.ts
import mermaidPlugin from '@bdocs/plugin-mermaid'

export default defineConfig({
  plugins: [
    mermaidPlugin({
      themes: { light: { ... }, dark: { ... } },
    }),
  ],
})
```

Available plugins:
- **[`@bdocs/plugin-mermaid`](https://www.npmjs.com/package/@bdocs/plugin-mermaid)** — transforms \`\`\`mermaid code blocks into interactive, theme-aware diagrams

### ⚙️ Rich Configuration

Every aspect of your docs site is configurable via `boltdocs.config.ts`:

```ts
export default defineConfig({
  siteUrl: 'https://docs.example.com',
  theme: {
    title: 'My Docs',
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg' },
    navbar: [{ label: 'Docs', href: '/docs' }],
    sidebar: { groups: [...] },
    social: { github: '...', discord: '...', x: '...' },
    tabs: [{ id: 'guides', text: 'Guides' }],
    codeTheme: { light: 'github-light', dark: 'github-dark' },
  },
  i18n: { defaultLocale: 'en', locales: { es: { label: 'Español' } } },
  versions: { defaultVersion: 'latest', versions: [{ path: 'v2.0', label: '2.0' }] },
  seo: { indexing: 'all', thumbnails: { background: '/og-image.webp' } },
  security: { csp: { directives: { ... } } },
  integrations: { ga4: { measurementId: 'G-XXXXXXXXXX' } },
  robots: { rules: [{ userAgent: '*', allow: '/' }], sitemaps: [...] },
})
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `boltdocs dev` | Start the development server with HMR |
| `boltdocs build` | Production build (SSG) |
| `boltdocs preview` | Preview the production build locally |
| `boltdocs doctor` | Run health checks on your documentation |
| `boltdocs changelog <file>` | Generate versioned changelog pages from CHANGELOG.md |
| `boltdocs audit` | Audit plugin dependencies for security warnings |

---

## Contributing

We welcome contributions! Check out the [Contributing Guide](CONTRIBUTING.md) to get started.

- **Branch naming**: `feat/`, `fix/`, `chore/` prefixes
- **Commits**: Conventional Commits
- **Tests**: Vitest — run `pnpm test`
- **Formatting**: Biome — run `pnpm format`

## License

MIT — see [LICENSE](LICENSE).

---

<p align="center">
  Built with ❤️ for the documentation community.
  <br />
  <a href="https://boltdocs.vercel.app">boltdocs.vercel.app</a>
</p>
