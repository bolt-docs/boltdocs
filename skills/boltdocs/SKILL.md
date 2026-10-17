---
name: boltdocs
description: Guidelines for developers using the Boltdocs documentation framework (3.4.0). Covers configuration, migration and upgrades, plugin API, MDX content, routing, collections, styling, and CLI usage.
---

# Boltdocs Agent Guidelines

This directory is the working knowledge base for anyone creating, extending, or maintaining a documentation project built on top of the **Boltdocs** framework. It targets **Boltdocs 3.4.0** — the React 19 + Vite 8.1 + Tailwind CSS v4 line, powered by the Sätteri Rust-based MDX processor.

Everything here is written so an AI pair-programmer can act without guessing: read the [reference guides](#reference-guides), then the page-relevant file.

## Overview

Boltdocs is a **React/Vite documentation framework with a first-class static site generator**. The parts you will actually touch:

- **File-system routing** — every `.md`/`.mdx` under the content folder maps to a URL, with `meta.json` for sidebar control.
- **Collections** — bracket directories (`[blog]`, `[changelog]`) with custom `post.tsx` / `list.tsx` / `layout.tsx` components.
- **Plugin system** — `definePlugin`/`createPlugin` with typed lifecycle hooks, client UI slots, providers, middleware, CSS injection, and virtual modules.
- **SSG pipeline** — `ConfigResolve → RouteGenerate → SEOValidate → TypeGenerate → SSGBuild → SEOWrite`, with a content-addressed page cache that re-renders only the edited page.
- **MDX processing** — the Sätteri Rust compiler (default) or standard `@mdx-js/mdx`.
- **i18n & versioning** — multi-locale (`docs/{locale}/…`) and multi-version (`docs/{version}/…`) trees with fallback generation.
- **Search** — offline **FlexSearch** by default, opt-in **Algolia**; exposed through the `useSearch()` hook.
- **Stable configuration** — declarative `redirects`, `robots`, `seo`, `security`, `integrations`, `ssg`, and `vite` overrides.
- **Experimental (opt-in)** — `experimental.viewTransitions` and `experimental.fileRouting`.
- **Agnostic styling** — Tailwind CSS v4, SASS/SCSS, UnoCSS, or vanilla CSS, all via plugins.
- **Style-neutral primitives** — layout/UI primitives ship structure + behavior + `data-*` state attributes; themes decide every visual.

## What's new (3.2 → 3.4)

| Release | Highlights that change how you work |
| --- | --- |
| **3.4.0** | New `@bdocs/contracts` package (framework-neutral contracts for routes, plugins, lifecycle, highlighting, search, config); `boltdocs` re-exports it, so the 3.x public API is unchanged. Content-addressed SSG page cache — a single page edit no longer re-renders the whole site. **Viewport-triggered prefetch**: `Link` accepts `prefetch="viewport"` (sidebar/navbar links opt in). View Transitions track direction (`forward`/`back`) and honor `prefers-reduced-motion`. File routing gains dynamic segments (`[slug]`, `[...parts]`). |
| **3.3.x** | Entry-bundle diet: KaTeX is baked at build time and FlexSearch loads on demand. Lazy `pages-external` loaders. Vite 8.1 toolchain alignment. axe-clean accessibility pass (tabs, OnThisPage, navbar, search). Shiki `colorHighlighting.options.colorReplacements`. |
| **3.2.0** | Nitro Phase 1 (5× faster warm builds, WASM highlighting, pipeline timing). `react-aria-components` became an explicit dependency — see [migrations](references/migrations.md). |

## When to apply

Use these guidelines when:

- Writing or refactoring `boltdocs.config.ts`
- Adding pages, sections, or folders under the content directory
- Creating or modifying plugins with `definePlugin`/`createPlugin`
- Writing MDX content with built-ins like `<Callout>`, `<Cards>`, or Mermaid diagrams
- Overriding HTML tags or registering global components in `mdx-components.tsx`
- Styling via CSS variables, Tailwind v4, SASS, or UnoCSS
- Theming or replacing layout primitives — style `data-*` state attributes, never bake visuals into a primitive
- Setting up collections, i18n, versioning, SEO, analytics, security, redirects, or experimental features
- Upgrading a project across Boltdocs versions — start with [Upgrading & Migration](references/migrations.md)
- Using the CLI (`dev`, `build`, `preview`, `audit`, `doctor`, `generate-changelog`)
- Authoring `.mdx` — read the [content conventions](#content-conventions-mdx-pages) first

## Reference guides

Read the matching file in `references/` for full detail:

1. **[Configuration](references/configuration.md)** — `defineConfig`, every top-level option: theme, i18n, versions, collections, plugins, SEO (incl. structured data), security, integrations, redirects, robots, drafts, feature flags, SSG, MDX, experimental, `aliases`, and Vite overrides.
2. **[Routing & directory organization](references/routing.md)** — file-system discovery, frontmatter, `meta.json`, tabs, i18n/versioning, external pages, static file routing, and redirects.
3. **[Collections](references/collections.md)** — bracket directories, custom `post.tsx`/`list.tsx`/`layout.tsx`, pagination, sorting, i18n.
4. **[Components](references/components.md)** — built-in MDX components, `mdx-components.tsx`, plugin client slots, layout primitives + state contract, `Link` prefetch, and view transitions.
5. **[Plugin API](references/plugin-api.md)** — `definePlugin`/`createPlugin`, lifecycle hooks, client config, context API, search contract, middleware, chain signals, validation.
6. **[Official plugins](references/plugins.md)** — every `@bdocs/plugin-*` package with install + config.
7. **[Styling](references/styling.md)** — Tailwind v4, SASS, UnoCSS, vanilla CSS, theme tokens, dark mode, primitive state styling.
8. **[CLI](references/cli.md)** — `dev`, `build`, `preview`, `doctor`, `audit`, `generate-changelog`, env vars.
9. **[Upgrading & migration](references/migrations.md)** — moving a project across the 3.x line and planning for 4.0.

## Upgrading & migration

Boltdocs is semver-minor friendly, but install-time peer changes and structural changes still need recipes. The full guide lives in **[references/migrations.md](references/migrations.md)**; the short version:

- **3.2.0** — declare `react-aria-components` yourself to clear the peer warning (it stopped being transitive). CI-strict setups have a scoped `.npmrc` fix.
- **3.3.x** — drop-in; benefits are automatic (build-time KaTeX, on-demand FlexSearch, lazy external pages).
- **3.4.0** — no code changes: `@bdocs/contracts` is a new published package and `boltdocs` re-exports it for backwards compatibility. New features are opt-in (`prefetch="viewport"`, `experimental.*`, `redirects`).
- **4.0** — see the docs roadmap (`/roadmap`) for the architecture migration plan before you adopt 4.x-only APIs.

## Content conventions (`.mdx` pages)

These keep the rendered site consistent and are enforced by the project's a11y and lint checks:

- **One H1 per page — never repeat the frontmatter title.** The layout already renders `<h1>{route.title}</h1>` and the `description` from frontmatter. Do **not** add a `# Title` heading or a description paragraph — it duplicates the heading and fails accessibility. Start with prose or the first `##` section.
- **Unique headings per page.** OnThisPage lists every `h2`–`h4`; duplicate text creates duplicate TOC entries (Playwright `on-this-page` test fails).
- **Canonical hrefs — never hand-write locale/version prefixes.** Links pass through `useLocalizedTo()`, which adds the active locale and version. Write `/docs/guides` (never `/es/docs/guides` or `/v2/docs/guides`). `site:/path` forces the site root; `https://…` passes through untouched.
- **Compact table separators.** markdownlint MD060 requires `| --- |` (spaces inside), never `|---|`.
- **Escape nested backticks.** To show a fenced block inside prose, wrap it in four backticks (` ```` ```mermaid ```` `), never a single backtick — the MDX preprocessor will swallow closing tags.

## Quick reference

| Package | npm name | Path | Purpose |
| --------- | ---------- | ------ | --------- |
| Core | `boltdocs` | `packages/core` | Engine: CLI, MDX pipeline, Vite plugins, routing, config, client UI |
| Contracts | `@bdocs/contracts` | `packages/contracts` | Framework-neutral contracts (routes, plugins, lifecycle, highlighting, search, config); re-exported by `boltdocs` |
| SSG | `@bdocs/ssg` | `packages/plugin-ssg` | Static Site Generator: client/server Vite builds, HTML rendering, content-addressed page cache |
| Parser | `@bdocs/parser` | `packages/parser` | Zig/WASM markdown parser with cross-platform native binaries |
| Processor (Sätteri) | `@bdocs/processor-satteri` | `packages/processor-satteri` | Rust-based MDX compiler (default processor) |
| Unist-utils | `@bdocs/unist-utils` | `packages/unist-utils` | Strictly-typed AST utilities for unist/mdast/hast |
| zig-critters | `@bdocs/zig-critters` | `packages/zig-critters` | WASM critical-CSS extractor used by the default `ssg.criticalCss` |
| Mermaid | `@bdocs/plugin-mermaid` | `packages/plugin-mermaid` | Remark plugin + React container for Mermaid diagrams |
| Math | `@bdocs/plugin-math` | `packages/plugin-math` | KaTeX math, baked at build time |
| Image Optimizer | `@bdocs/plugin-image-optimizer` | `packages/plugin-image-optimizer` | Sharp/SVGO image optimization |
| Ask AI | `@bdocs/plugin-ask-ai` | `packages/plugin-ask-ai` | Context-aware AI assistant |
| RSS | `@bdocs/plugin-rss` | `packages/plugin-rss` | RSS and Atom feeds |
| LLMs Text | `@bdocs/plugin-llms-text` | `packages/plugin-llms-text` | `llms.txt` generation |
| Tailwind CSS | `@bdocs/plugin-tailwindcss` | `packages/plugin-tailwindcss` | Tailwind CSS v4 via `@tailwindcss/vite` |
| SASS/SCSS | `@bdocs/plugin-sass` | `packages/plugin-sass` | SASS/SCSS preprocessor |
| UnoCSS | `@bdocs/plugin-unocss` | `packages/plugin-unocss` | UnoCSS via `@unocss/vite` |
| Scaffolder | `create-boltdocs` | `packages/create-boltdocs` | `create-boltdocs` project scaffolder |

## Common patterns

```ts title="boltdocs.config.ts"
import path from 'node:path'
import { defineConfig } from 'boltdocs'
import tailwindcssPlugin from '@bdocs/plugin-tailwindcss'
import mermaidPlugin from '@bdocs/plugin-mermaid'
import mathPlugin from '@bdocs/plugin-math'
import rssPlugin from '@bdocs/plugin-rss'

export default defineConfig({
  siteUrl: 'https://docs.example.com',
  base: '/',
  aliases: { '@': path.resolve(import.meta.dirname, 'src') },
  theme: {
    title: 'My Docs',
    favicon: '/favicon.svg',            // relative to public/
    logo: { light: '/logo-dark.svg', dark: '/logo-light.svg' },
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
  redirects: [{ from: '/docs/old', to: '/docs/new' }],
  plugins: [
    tailwindcssPlugin(),
    mathPlugin(),
    rssPlugin(),
    mermaidPlugin({ themes: { light: 'neutral', dark: 'dark' } }),
  ],
})
```

## Ground rules

- **Never suggest a `vite.config.ts`.** Boltdocs builds the Vite pipeline internally; use the `vite` config key only for deliberate overrides.
- **Use `defineConfig`** for autocomplete and validation.
- **Keep links canonical** (`/docs/...`) and let the resolver add locale/version.
- **Do not bake visuals into primitives** — emit `data-*` state and style it from the theme.
- **Preserve existing plugin version ranges** (`boltdocsVersion`) when editing configs.
