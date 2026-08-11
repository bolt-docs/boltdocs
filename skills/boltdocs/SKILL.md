---
name: boltdocs
description: Guidelines for developers using the Boltdocs documentation framework. Covers configuration, plugin API, MDX content, routing, collections, styling, and CLI usage.
---

# Boltdocs Agent Guidelines

This directory establishes standards and blueprints for developers creating, extending, or maintaining a documentation project built on top of the **Boltdocs** framework.

## Overview

Boltdocs is a **React/Vite documentation framework** powered by the Sätteri Rust-based MDX processor. It features:

- **File-system routing**: Every `.md`/`.mdx` file in the `docs/` folder maps to a URL
- **Collection system**: Bracket directories (`[blog]`) for blogs, changelogs, release notes
- **Plugin system (`definePlugin`)**: Astro-inspired lifecycle hooks, client UI slots, middleware pipeline, CSS injection, virtual modules
- **SSG pipeline**: Production build pipeline with config resolution, route generation, SEO, SSG, and post-build asset hooks
- **MDX processing**: Sätteri Rust-based compiler (default) or standard MDX processor
- **i18n & versioning**: Multi-locale and multi-version documentation support
- **Search contract**: Standardized `SearchDocument[]` interface for search engine plugins
- **Client registry**: Plugin-provided UI slots, providers, MDX components, and head elements
- **Plugin context APIs**: Caches, diagnostics, paths, virtual modules, middleware, HMR, and server APIs
- **`@bdocs/plugin-llms-text`**: Automatic `llms.txt` file generation for LLM optimization (llmstxt.org)
- **CSS framework agnostic**: Tailwind CSS v4, SASS/SCSS, UnoCSS, or vanilla CSS — all supported via plugins

## When to Apply

Use these guidelines when:

- Writing or refactoring configuration inside `boltdocs.config.ts`
- Adding new documentation sections, pages, or folders under `docs/`
- Creating or modifying plugins using `definePlugin` or `createPlugin`
- Writing MDX page content using built-in components like `<Callout>`, `<Card>`, or Mermaid diagrams
- Overriding HTML tags or registering global React components in `mdx-components.tsx`
- Styling the documentation theme via CSS variables, Tailwind CSS v4, SASS, or UnoCSS
- Setting up collections (`[blog]`, `[changelog]`) with custom post/list/layout components
- Configuring i18n, versioning, SEO, analytics, or security features
- Using the CLI commands (dev, build, preview, audit, doctor, generate-changelog)
- Writing plugins that inject UI slots, providers, or middleware into the pipeline
- Writing `.mdx` page content — see the content conventions below before adding headings or links

## Reference Guides

Read the following documents in the `references/` directory for detailed specifications:

1. **[Configuration Guide](references/configuration.md)**
   - Customizing `boltdocs.config.ts` using `defineConfig`
   - Complete config reference: theme, i18n, versions, collections, plugins, SEO, security, integrations, drafts, feature flags, SSG, MDX processor
   - Vite configuration overrides

2. **[Routing & Directory Organization](references/routing.md)**
   - File-system page discovery and URL mapping
   - Frontmatter fields (title, sidebarPosition, badge, icon, tags, author, draft, etc.)
   - `meta.json` directory configuration (sidebar ordering, collapsible groups, icons)
   - Tab alignment with `theme.tabs`
   - i18n routes (`/{locale}/docs/...`) and versioning (`/{version}/docs/...`)

3. **[Collections System](references/collections.md)**
   - Bracket directories (`[blog]`, `[changelog]`) for content collections
   - Custom post.tsx, list.tsx, layout.tsx components per collection
   - Pagination, sorting, date formatting
   - Collection configuration in `boltdocs.config.ts`

4. **[Built-in & Custom Components](references/components.md)**
   - Built-in MDX components: Callout, Cards, Tabs, Timeline, Mermaid, Math
   - Custom components via `mdx-components.tsx`
   - Plugin client UI slots (`'header:right'`, `'search:dialog'`, etc.)
   - Plugin-provided MDX components and providers

5. **[Plugin API](references/plugin-api.md)**
   - `definePlugin` and `createPlugin` API reference
   - Lifecycle hooks (`build:before`, `build:after`, `transform:source`, `frontmatter:transform`, `search:index`, etc.)
   - Client UI slots (`client.slots`, `client.providers`, `client.mdxComponents`, `client.head`)
   - Plugin context APIs: caches, diagnostics, paths, virtual modules, middleware, HMR, server
   - Search contract (`SearchDocument[]`)
   - Middleware pipeline and chain signals (`__signal: 'skip' | 'break'`)
   - Plugin validation and error handling

6. **[Official Plugins](references/plugins.md)**
   - All `@bdocs/*` plugins: Tailwind CSS, SASS/SCSS, UnoCSS, Mermaid, Math, RSS, Image Optimizer, Ask AI, LLMs Text
   - Installation, configuration, and usage examples

7. **[Styling & Theme Customization](references/styling.md)**
   - Tailwind CSS v4 setup with `@bdocs/plugin-tailwindcss`
   - SASS/SCSS with `@bdocs/plugin-sass`
   - UnoCSS with `@bdocs/plugin-unocss`
   - Vanilla CSS and CSS Modules (zero-config core support)
   - Theme CSS variables and semantic color mappings
   - Dark mode overrides and `@custom-variant` syntax
   - Biome compatibility

8. **[CLI Reference](references/cli.md)**
   - `boltdocs dev` — development server
   - `boltdocs build` — production build
   - `boltdocs preview` — preview production build
   - `boltdocs doctor` — documentation health check
   - `boltdocs audit` — plugin security audit
   - `boltdocs generate-changelog` — changelog from CHANGELOG.md

## Content Conventions (`.mdx` pages)

These rules keep the rendered site consistent and are enforced by the project's a11y and lint checks:

- **One H1 per page — never repeat the frontmatter title.** The default layout renders the page title as `<h1>{currentRoute.title}</h1>` and the `description` under it, both from frontmatter. Do **not** add a `# Title` heading or a description paragraph to the content — it renders as a duplicated heading and is an accessibility failure. Content starts with prose or the first `##` section directly.
- **Unique headings per page.** The OnThisPage TOC lists every `h2`–`h4`; duplicate heading text produces duplicate TOC entries. Playwright test `tests/a11y/on-this-page.spec.ts` fails on duplicates.
- **Canonical hrefs — never hand-write locale/version prefixes.** All links go through `useLocalizedTo()`, which adds the active locale and version. Write `/docs/guides` (never `/es/docs/guides` or `/v2/docs/guides`). External URLs (`https://...`) pass through untouched; `/showcase`-style `pages-external/` routes stay as-is. `theme.navbar` items support only `{ label, href, items? }` — there is no `to` field in config.
- **Compact table separators.** markdownlint MD060 requires `| --- |` (spaces inside), never `|---|`.

## Quick Reference

| Package | npm name | Path | Purpose |
| --------- | ---------- | ------ | --------- |
| Core | `boltdocs` | `packages/core` | Main engine: CLI, MDX pipeline, Vite plugins, routing, config |
| SSG | `@bdocs/ssg` | `packages/plugin-ssg` | Static Site Generator: client/server Vite builds, HTML rendering |
| Mermaid | `@bdocs/plugin-mermaid` | `packages/plugin-mermaid` | Remark plugin + React container for Mermaid.js diagrams |
| Math | `@bdocs/plugin-math` | `packages/plugin-math` | KaTeX math parsing with remark/preprocessing |
| Image Optimizer | `@bdocs/plugin-image-optimizer` | `packages/plugin-image-optimizer` | Sharp/SVGO image optimization Vite plugin |
| Ask AI | `@bdocs/plugin-ask-ai` | `packages/plugin-ask-ai` | Context-aware AI assistant querying plugin |
| RSS | `@bdocs/plugin-rss` | `packages/plugin-rss` | RSS and Atom feeds generation |
| LLMs Text | `@bdocs/plugin-llms-text` | `packages/plugin-llms-text` | llms.txt specification file generation |
| Tailwind CSS | `@bdocs/plugin-tailwindcss` | `packages/plugin-tailwindcss` | Tailwind CSS v4 integration via `@tailwindcss/vite` |
| SASS/SCSS | `@bdocs/plugin-sass` | `packages/plugin-sass` | SASS/SCSS preprocessor with Vite configuration |
| UnoCSS | `@bdocs/plugin-unocss` | `packages/plugin-unocss` | UnoCSS atomic CSS engine via `@unocss/vite` |
| Unist-utils | `@bdocs/unist-utils` | `packages/unist-utils` | Strictly-typed AST utilities for unist/mdast/hast |
| Processor (Sätteri) | `@bdocs/processor-satteri` | `packages/processor-satteri` | Rust-based MDX compiler (default processor) |
| Parser | `@bdocs/parser` | `packages/parser` | Zig/WASM markdown parser with native binaries |

## Common Patterns

```ts
// boltdocs.config.ts — full configuration
import { defineConfig } from 'boltdocs'
import tailwindcssPlugin from '@bdocs/plugin-tailwindcss'
import mermaidPlugin from '@bdocs/plugin-mermaid'
import mathPlugin from '@bdocs/plugin-math'
import rssPlugin from '@bdocs/plugin-rss'

export default defineConfig({
  siteUrl: 'https://docs.example.com',
  theme: {
    title: 'My Docs',
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg' },
    githubRepo: 'user/repo',
    tabs: [
      { id: 'guides', text: 'Guides', icon: 'BookOpen' },
      { id: 'api', text: 'API', icon: 'Code2' },
    ],
  },
  i18n: {
    defaultLocale: 'en',
    locales: { en: 'English', es: 'Español' },
  },
  plugins: [
    tailwindcssPlugin(),
    mathPlugin(),
    rssPlugin(),
    mermaidPlugin({
      themes: { light: 'neutral', dark: 'dark' },
    }),
  ],
})
```
