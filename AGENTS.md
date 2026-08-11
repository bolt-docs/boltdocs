# Boltdocs Repository Agent Guide

## Quick Reference

1. **Package manager**: `pnpm` only. Never use `npm` or `yarn`.
2. **Code style**: Biome — single quotes, no semicolons, 2-space indent, `formatWithErrors: true`.
3. **TypeScript**: Strict mode. Use `import type` for type-only imports.
4. **Path alias**: `@` resolves to `packages/core/src` (configured in `vitest.config.ts:13` and `packages/core/src/node/index.ts:150-154`).
5. **Before committing**: Run `pnpm run format` to auto-format with Biome.

## Monorepo Structure

Boltdocs is a React/Vite documentation framework. Monorepo managed by Turborepo + pnpm workspaces.

### Packages

| Package | npm name | Path | Purpose |
| --------- | ---------- | ------ | --------- |
| Core | `boltdocs` | `packages/core` | Main engine: CLI, MDX pipeline, Vite plugins, routing, config |
| SSG | `@bdocs/ssg` | `packages/plugin-ssg` | Static Site Generator: client/server Vite builds, HTML rendering |
| Mermaid | `@bdocs/plugin-mermaid` | `packages/plugin-mermaid` | Remark plugin + React container for Mermaid.js diagrams |
| Math | `@bdocs/plugin-math` | `packages/plugin-math` | KaTeX math parsing with remark/preprocessing |
| Image Optimizer | `@bdocs/plugin-image-optimizer` | `packages/plugin-image-optimizer` | Sharp/SVGO image optimization Vite plugin |
| Ask AI | `@bdocs/plugin-ask-ai` | `packages/plugin-ask-ai` | Context-aware AI assistant querying plugin |
| Create | `create-boltdocs` | `packages/create-boltdocs` | Scaffolder CLI for new projects |
| Parser | `@bdocs/parser` | `packages/parser` | Zig/WASM markdown parser with cross-platform native binaries |

### Workspace Dependencies

```text
boltdocs (core)
  ├── @bdocs/ssg
  ├── @bdocs/parser (workspace:*)
  └── @bdocs/plugin-image-optimizer (workspace:*)
```

Plugins (`plugin-mermaid`, `plugin-math`, `plugin-ask-ai`) depend on `boltdocs` as a devDependency.

### Other Directories

- `docs/` — User-facing documentation site source (`boltdocs.config.ts`)
- `tests/` — Integration and unit tests
- `scripts/` — Build-time helper scripts (e.g., `generate-doctor-schema.ts`)
- `assets/` — Static assets for the repository

## Code Style & Conventions

**Config**: `biome.json` (Biome 2.4.9)

### Formatting Rules

- **Indent**: 2 spaces (`indentStyle: "space"`, `indentWidth: 2`)
- **Quotes**: Single quotes in JS/TS (`quoteStyle: "single"`)
- **Semicolons**: Omit when possible (`semicolons: "asNeeded"`)
- **Format with errors**: Enabled (`formatWithErrors: true`)
- **CSS**: Tailwind directives supported (`tailwindDirectives: true`), CSS linting disabled

### Linting Rules

- Recommended rules enabled
- `noDangerouslySetInnerHtml`: off
- `useKeyWithClickEvents`: off
- `noStaticElementInteractions`: off
- `useButtonType`: off
- `useSemanticElements`: off
- `noArrayIndexKey`: info (warning, not error)
- Import organization: disabled (`organizeImports: "off"`)

### Commands

```bash
pnpm run format              # Format entire repo
pnpm run format:core         # Format packages/core/src only
pnpm exec biome check --write  # Lint + format packages/core
```

## Documentation Content Conventions

These rules apply to every `.mdx` page under `docs/`. They keep the rendered site consistent and avoid accessibility regressions.

### One H1 per page — never repeat the frontmatter title

The default layout already renders the page title as an `<h1>` (`<h1>{currentRoute.title}</h1>`) and the `description` under it, both sourced from frontmatter. **Do not add a `# Title` heading (or a description paragraph) to the content** — it renders as a duplicated heading with a link icon right below the theme's own title, and it is an accessibility failure. Content should start directly with prose or the first `##` section:

```markdown
---
title: Navigation
description: The complete navigation model.
---

# ❌ WRONG — the theme already renders this H1

✅ Correct: start with prose or `## First Section` directly.
```

### Unique headings per page

The OnThisPage right-rail TOC lists every `h2`–`h4` on the page. Duplicate heading text (`### Search` twice) produces duplicate TOC entries. Keep heading text unique per page; there is a Playwright regression test (`tests/a11y/on-this-page.spec.ts`) that fails on duplicates.

### Canonical hrefs — never hand-write locale/version prefixes

Every link (navbar, sidebar, cards, MDX) goes through `useLocalizedTo()`, which prepends the active locale and version automatically. Write **canonical, unlocalized paths**:

| Href | Kind | Notes |
| ------ | ------ | ------- |
| `/docs/guides` | Docs page | Localized automatically — never write `/es/docs/guides` or `/v2/docs/guides` |
| `/showcase` | External page (`pages-external/`) | Kept as-is by the resolver |
| `https://example.com` | External URL | Passed through untouched — no `to: 'external'` flag exists in config |
| `#section`, `?q=term` | Anchor / query | Joined to the current page |
| `site:/path` | Site root-relative | `site:` forces resolution against the site root |

`theme.navbar` items only support `{ label, href, items? }` — the `to="external"` prop exists only on the `Navbar.Link` **component**, not in config.

### Markdown tables use compact separators

markdownlint (MD060) requires compact table separators: `| --- |` (spaces inside), never dense `|---|`. This is enforced by CI lint.

### Views: View Transitions stay OFF in the official docs

The docs site (`docs/boltdocs.config.ts`) keeps `experimental.viewTransitions.enabled: false`. Keep it that way — the default layout must behave identically for every visitor. Documentation of the feature stays in the guides.

## TypeScript Conventions

**Config**: `tsconfig.json` (root), per-package `tsconfig.json`

### Compiler Options

```json
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "Bundler",
  "strict": true,
  "skipLibCheck": true,
  "jsx": "react-jsx",
  "declaration": true,
  "esModuleInterop": true
}
```

### Import Patterns

```typescript
// ✅ Correct — type-only imports use `import type`
import type { Plugin } from 'vite'
import type { BoltdocsConfig } from '../config'

// ✅ Correct — value imports
import path from 'node:path'
import fs from 'node:fs'

// ✅ Correct — named exports
export { generateRoutes } from './routes'
export type { RouteMeta } from './routes'

// ❌ Wrong — do not use `require()` (ESM project)
const fs = require('fs')
```

### Path Aliases

- `@` → `packages/core/src` (used in vitest and dev server)
- `boltdocs/entry` → `boltdocs-entry.tsx` (user project root)
- `boltdocs/client` → `boltdocs-client.mjs` (user project root)
- `virtual:boltdocs-*` → Virtual modules (resolved by plugin)

### File Extensions

- Source: `.ts` (Node), `.tsx` (React components)
- Output: `.mjs` (ESM), `.cjs` (CJS), `.d.ts` / `.d.mts` (types)
- Build tool: `tsdown` with `--config-loader unrun`

## Component Architecture

**Path**: `packages/core/src/client/components/`

### Directory Structure

```text
components/
├── ui-base/           # Reusable UI primitives (exported)
│   ├── navbar.tsx
│   ├── sidebar.tsx
│   ├── breadcrumbs.tsx
│   ├── on-this-page.tsx
│   ├── page-nav.tsx
│   ├── error-boundary.tsx
│   ├── copy-markdown.tsx
│   ├── search-dialog.tsx
│   ├── not-found.tsx
│   ├── banner.tsx
│   ├── feedback.tsx
│   ├── giscus.tsx
│   ├── theme-toggle.tsx
│   ├── i18n-selector.tsx
│   ├── version-selector.tsx
│   ├── tabs.tsx
│   └── index.ts       # Barrel file
├── primitives/         # Low-level layout components
│   └── docs-layout.tsx
├── internal/           # Internal components (not exported to users)
│   └── error-boundary.tsx
├── mdx/                # MDX-specific components
│   └── use-code-block.tsx
├── icons-prod.tsx      # Eager-bundled social/nav icons (Github, Discord, XSocial, Bluesky) — used by navbar/sidebar. Re-exports `IconProps`.
│   └── (used by components/primitives/navbar.tsx + components/ui-base/{navbar,github-stars}.tsx)
│
└── mdx/lang-icons.tsx  # Lazy-loaded language icons for MDX code blocks (TypeScript, JavaScript, React, JSON, CSS, HTML, Markdown, Shell, YAML, Rust, TOML, CSV).
    └── Imported via `const langIconsPromise = import('./lang-icons')` in `mdx/use-code-block.ts` and stored in `useState<map | null>(null)`. Falls back to the generic `File` icon during SSR and the brief hydration window before the dynamic import resolves. Pages without code blocks ship zero bytes of these icons.
└── docs-layout-default.tsx  # Default layout composition
```

### Component Patterns

- **Context providers**: `app/` directory contains context providers (`config-context.tsx`, `theme-context.tsx`, `ui-context.tsx`, `routes-context.tsx`, `mdx-components-context.tsx`)
- **Hooks**: `hooks/` directory — 17 hooks prefixed with `use-` (e.g., `use-routes.ts`, `use-sidebar.ts`, `use-search.ts`)
- **Shell**: `BoltdocsShell` in `ssg/boltdocs-shell.tsx` wraps the entire app with providers
- **Layout**: `DocsLayout` in `components/docs-layout-default.tsx` composes navbar, sidebar, content, and on-this-page

### Exported Components (from `client/index.ts`)

```typescript
export { DocsLayout } from './components/docs-layout-default'
export { Navbar } from './components/ui-base/navbar'
export { Sidebar } from './components/ui-base/sidebar'
export { OnThisPage } from './components/ui-base/on-this-page'
export { Breadcrumbs } from './components/ui-base/breadcrumbs'
export { PageNav } from './components/ui-base/page-nav'
export { ErrorBoundary } from './components/ui-base/error-boundary'
export { CopyMarkdown } from './components/ui-base/copy-markdown'
export { SearchDialog } from './components/ui-base/search-dialog'
export { NotFound } from './components/ui-base/not-found'
export { Banner } from './components/ui-base/banner'
```

## Plugin System

### Plugin Interface

**File**: `packages/core/src/node/plugins/plugin-types.ts`

```typescript
interface SecureBoltdocsPlugin {
  name: string                    // Required, must be unique
  enforce?: 'pre' | 'post'       // Plugin ordering
  version?: string                // Plugin version
  boltdocsVersion?: string        // Semver range for compatibility
  remarkPlugins?: unknown[]       // Remark plugins for MDX
  rehypePlugins?: unknown[]       // Rehype plugins for MDX
  vitePlugins?: VitePlugin[]      // Additional Vite plugins
  components?: Record<string, string>  // Component name → file path
  hooks?: PluginLifecycleHooks    // Lifecycle hooks
}
```

### Lifecycle Hooks

**File**: `packages/core/src/node/plugins/plugin-types.ts:32-50`

```typescript
interface PluginLifecycleHooks {
  // Build lifecycle
  beforeBuild?: (ctx: PluginContext) => Promise<void> | void
  afterBuild?: (ctx: PluginContext) => Promise<void> | void
  buildEnd?: (ctx: PluginContext) => Promise<void> | void

  // Dev lifecycle
  beforeDev?: (ctx: PluginContext) => Promise<void> | void
  afterDev?: (ctx: PluginContext) => Promise<void> | void

  // Transform chains (return modified params)
  transformSource?: (ctx, { code, filePath }) => Promise<{ code }> | { code }
  transformMdx?: (ctx, { code, filePath }) => Promise<{ code }> | { code }
  transformHtml?: (ctx, { html, path }) => Promise<{ html }> | { html }
}
```

### Plugin Context

**File**: `packages/core/src/node/plugins/plugin-types.ts:4-12`

```typescript
interface PluginContext {
  readonly config: BoltdocsConfig   // Frozen config
  readonly logger: PluginLogger     // info/warn/error/debug
  readonly store: PluginStore       // Key-value store per plugin
  readonly meta: PluginMeta         // name, version, boltdocsVersion
  readonly docsDir: string          // Absolute path to docs/
  readonly rootDir: string          // Absolute path to project root
  readonly outDir: string           // Build output directory (e.g., 'dist/')
  readonly routes: RouteMeta[]      // All generated documentation routes
}
```

### Creating a Plugin

```typescript
import { createPlugin } from 'boltdocs'

export default createPlugin({
  name: 'my-plugin',
  version: '1.0.0',
  boltdocsVersion: '>=2.0.0',
  remarkPlugins: [myRemarkPlugin],
  rehypePlugins: [myRehypePlugin],
  hooks: {
    async beforeBuild(ctx) {
      ctx.logger.info('Building...')
    },
    async transformMdx(ctx, { code, filePath }) {
      return { code: code.replace(/foo/g, 'bar') }
    },
  },
})
```

### Plugin Validation

**File**: `packages/core/src/node/plugins/plugin-validator.ts`

- Plugins validated against `SecurePluginSchema` (Zod)
- Duplicate plugin names rejected
- Version compatibility checked via `semver.satisfies()`
- Component paths validated against traversal (`..` rejected)
- Plugin ordering: `pre` → normal → `post` (via `enforce` field)

### Plugin Lifecycle Execution

**File**: `packages/core/src/node/plugins/plugin-lifecycle.ts`

- `runHook()`: Runs hook on all plugins in order (parallel-safe via Pipeline)
- `runChain()`: Runs transform hooks sequentially, piping `params` through each plugin
- Rollback: On failure, completed steps run their `buildEnd` hook in reverse

## Virtual Modules System

**File**: `packages/core/src/node/plugin/virtual-modules.ts`

All `virtual:boltdocs-*` modules are resolved by the `vite-plugin-boltdocs-virtual-modules` plugin.

### Available Virtual Modules

| Module | Purpose | Invalidation |
| -------- | --------- | -------------- |
| `virtual:boltdocs-routes.ts` | Route tree (JSON) | File add/unlink/change |
| `virtual:boltdocs-config.ts` | Client config + directory meta | File add/unlink |
| `virtual:boltdocs-search.ts` | Search index data | File add/unlink/change |
| `virtual:boltdocs-collections.ts` | Collection data | File add/unlink |
| `virtual:boltdocs-entry.tsx` | App entry point | Config change |
| `virtual:boltdocs-mdx-components.tsx` | User MDX components | `mdx-components.{tsx,ts,jsx,js}` change |
| `virtual:boltdocs-layout.tsx` | User layout | `layout.{tsx,jsx}` change |
| `virtual:boltdocs-icons.tsx` | User icons | `icons.{tsx,jsx,ts,js}` change |
| `virtual:boltdocs-client` | Client package re-export | — |

### Invalidation Pattern

```typescript
function invalidateVirtualModule(server: ViteDevServer, name: string): void {
  const mod = server.moduleGraph.getModuleById(`\0virtual:boltdocs-${name}.ts`)
  if (mod) server.moduleGraph.invalidateModule(mod)
}
```

**Caching**: Virtual module results are cached in module-level variables (`_routesCache`, `_searchDataCache`, etc.). Cache is cleared by `invalidateDirectoryMetaCache()` on file add/unlink events.

## Build System

### Package Build: tsdown

All packages use `tsdown` (Rolldown-based bundler) with `--config-loader unrun`:

```json
{
  "scripts": {
    "build": "tsdown --config-loader unrun",
    "dev": "tsdown --watch --config-loader unrun"
  }
}
```

### Turborepo Pipeline

**File**: `turbo.json`

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^lint"] },
    "typecheck": { "dependsOn": ["^typecheck"] },
    "test": { "dependsOn": ["^test"] }
  }
}
```

- `build` depends on `^build` (all upstream packages must build first)
- `dev` is not cached and runs persistently

### Build Pipeline (Production)

**File**: `packages/core/src/node/pipeline/build-pipeline.ts`

```text
ConfigResolve → RouteGenerate → SEOValidate → TypeGenerate → SSGBuild → SEOWrite
```

Each step is a `PipelineStep<BuildContext>` with `execute()` and optional `rollback()`.

### SSG Build: Two Vite Builds

**File**: `packages/plugin-ssg/src/node/build.ts:311-410`

1. **Client build** (`viteBuild` with `manifest: true, ssrManifest: true`)
   - Produces client bundle + SSR manifest
   - Cached via `computeClientCodeHash()` — skips if hash unchanged
2. **Server build** (`viteBuild` with `ssr: ssrEntry`)
   - Produces SSR bundle for static HTML rendering
   - Uses `createStaticHandler` from react-router-dom

### Client Code Hash

**File**: `packages/plugin-ssg/src/node/build.ts:112-152`

`computeClientCodeHash()` recursively scans ALL files in the project root AND workspace packages directory (`packages/`). Uses `mtime` + `size` for each file. This is expensive in monorepos.

### Cache System

**File**: `packages/core/src/node/cache.ts`

- `FileCache<T>`: Generic file-based cache with LRU eviction
- `AssetCache`: Per-asset cache with shards (for MDX transforms)
- MDX results are gzipped in production (`compress: true`)
- Cache directory: `.boltdocs/` (gitignored)
- Configurable via `BOLTDOCS_CACHE_DIR`, `BOLTDOCS_NO_CACHE`, `BOLTDOCS_CACHE_COMPRESS` env vars

### Build Commands

```bash
pnpm run build           # Full Turborepo build (all packages)
pnpm run build:core      # Build core package only (pnpm --filter boltdocs build)
pnpm run release         # Build + changeset publish
```

## Dev Server & HMR

### Dev Server Setup

**File**: `packages/core/src/node/cli/dev.ts`

1. `resolveConfig()` loads `boltdocs.config.{js,mjs,ts}`
2. `createViteConfig()` builds full Vite `InlineConfig` with all plugins
3. `createServer()` from `@bdocs/ssg/node` starts Vite dev server
4. `server.listen()` starts listening

### Dev Server Plugin

**File**: `packages/core/src/node/dev-server/index.ts`

The `vite-plugin-boltdocs-dev-server` plugin runs on `apply: 'serve'`:

1. Runs `beforeDev` lifecycle hook
2. Generates link tree (background)
3. Sets up prewarming, middlewares, watcher, HMR
4. Runs `afterDev` lifecycle hook

### Prewarming

**File**: `packages/core/src/node/dev-server/prewarm.ts`

After server start, batches of 32 files are pre-transformed via `server.transformRequest()` to warm the Vite module graph.

### HMR Handler

**File**: `packages/core/src/node/dev-server/hmr-handler.ts`

File events (`add`, `unlink`, `change`) are handled with debouncing (150ms):

| Event | Action |
| ------- | -------- |
| Config file change | `server.restart()` |
| `mdx-components.{ext}` change | Invalidate `mdx-components.tsx`, full reload |
| `icons.{ext}` change | Invalidate `icons.tsx`, full reload |
| `layout.{ext}` change | Invalidate `layout.tsx`, full reload |
| File in `pages-external/` | Invalidate `entry`, full reload |
| File add/unlink (in docs/) | Invalidate routes + config + search + collections, full reload |
| `meta.json` change | Same as add/unlink |
| Content change (`.md`/`.mdx`) | Frontmatter hash check → if changed: invalidate routes; else: HMR via module invalidation |

### HMR for Content Changes

1. Compute frontmatter hash of changed file
2. Compare with previous hash
3. If hash changed (frontmatter metadata changed): invalidate routes, full reload
4. If hash same (only body changed): invalidate specific Vite modules, send `boltdocs:mdx-update` event

## Route Generation

**File**: `packages/core/src/node/routes/index.ts`

### File Crawling

- Uses `fdir` for fast directory crawling
- Filters: `.md` and `.mdx` files only
- Excludes files/directories starting with `_` (except `_index.md`/`_index.mdx`)

### Route Sorting

**File**: `packages/core/src/node/routes/sorter.ts`

- Ungrouped items come first
- Items sorted by `sidebarPosition` (or `groupPosition` for groups)
- Default position: 999
- Ties broken alphabetically by title

### Route Metadata

**File**: `packages/core/src/node/routes/types.ts`

Key fields: `path`, `componentPath`, `title`, `filePath`, `group`, `groupTitle`, `locale`, `version`, `badge`, `icon`, `tab`, `collection`, `tags`, `author`, `draft`, `excerpt`, `coverImage`, `frontmatter`

### Collection Directories

- Directories named `[collection-name]/` create collection routes
- Posts within have `collection`, `date`, `tags`, `author`, `coverImage` metadata

### i18n & Versioning

- Locale prefixes: `/{locale}/docs/...`
- Version prefixes: `/{version}/docs/...`
- Fallback generation for missing translations

### Route Invalidation

```typescript
invalidateRouteCache()  // Clears file list, localized path cache, native docs cache
invalidateFile(path)    // Removes specific file from native docs cache
```

## Testing

### Framework

- **Vitest** with `globals: true` (no need to import `describe`/`it`/`expect`)
- **Coverage**: V8 provider
- **Environment**: `node`

### Configuration

**File**: `vitest.config.ts`

```typescript
{
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/a11y/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './packages/core/src') },
  },
  coverage: {
    provider: 'v8',
    include: ['packages/core/src/**/*.ts', 'packages/ssg/src/**/*.ts'],
    exclude: ['**/*.test.ts', '**/node_modules/**', '**/dist/**', '**/*.d.ts'],
  },
}
```

### Test Commands

```bash
pnpm run test              # Run core tests (pnpm --filter boltdocs test)
pnpm run test:core         # Same as above
pnpm run test:ssg          # SSG tests (pnpm --filter @bdocs/ssg test)
pnpm run test:all          # All package tests
pnpm run test:coverage     # With V8 coverage
pnpm run test:a11y         # Playwright accessibility tests
```

### Test Patterns

- Test files: `**/*.test.ts` (colocated with source or in `tests/`)
- Integration tests: `tests/integration/`
- Use `@` alias for imports in tests
- `@testing-library/react` for component tests
- `@testing-library/jest-dom` for DOM matchers

## Security Model

### Error Hierarchy

**File**: `packages/core/src/node/errors.ts`

```text
SecurityViolationError (base)
├── PathTraversalError       # Directory traversal attempts
├── EncodingSecurityError    # Malicious character encoding
└── ValidationError          # Schema/size validation failures
```

### Security Constants

**File**: `packages/core/src/node/security/constants/index.ts`

```typescript
MAX_PATH_LENGTH = 260
ALLOWED_PATH_CHARS = /^[a-zA-Z0-9\-_/.()[\]]+$/
MAX_FRONTMATTER_SIZE = 10 * 1024  // 10KB
```

### Frontmatter Validation

**File**: `packages/core/src/node/schema/frontmatter.ts`

Uses `z.looseObject()` — validates known fields, passes through unknown fields.

Known fields: `title`, `description`, `sidebarPosition`, `sidebarLabel`, `sidebarHidden`, `badge`, `icon`, `date`, `lastUpdated`, `groupTitle`, `groupPosition`, `seo`, `tags`, `author`, `draft`, `excerpt`, `coverImage`, `category`, `order`

### Config Validation

**File**: `packages/core/src/node/schema/config.ts`

Full Zod schema for `BoltdocsConfig` including theme, i18n, versions, plugins, security, robots, social links, and integrations.

### Path Security

- `normalizePath()`: Converts `\` to `/` for cross-platform consistency
- `sanitizeFilename()`: Removes dangerous characters
- `ALLOWED_PATH_CHARS` regex: Only alphanumeric, `-`, `_`, `/`, `.`, `()`, `[]`

## Key File Reference

| File | Key Functions/Lines |
| ------ | ------------------- |
| `packages/core/src/node/index.ts` | `boltdocs()` (7), `createViteConfig()` (43) |
| `packages/core/src/node/config.ts` | `resolveConfig()` (62), `CONFIG_FILES` (37) |
| `packages/core/src/node/routes/index.ts` | `generateRoutes()` (57), `invalidateRouteCache()` (39) |
| `packages/core/src/node/routes/sorter.ts` | `sortRoutes()` (11) |
| `packages/core/src/node/plugin/index.ts` | `boltdocsPlugin()` (45), plugin array (86-283) |
| `packages/core/src/node/plugin/virtual-modules.ts` | `createVirtualModulesPlugin()` (33) |
| `packages/core/src/node/dev-server/index.ts` | `createDevServerPlugin()` (11) |
| `packages/core/src/node/dev-server/hmr-handler.ts` | `setupHmr()` (25), `handleFileEvent()` (34) |
| `packages/core/src/node/dev-server/prewarm.ts` | `setupPrewarming()` (8) |
| `packages/core/src/node/mdx/highlighter.ts` | `highlight()` (24) |
| `packages/core/src/node/mdx/shiki-adapter.ts` | `ShikiAdapter` (48), `getShikiAdapter()` (145) |
| `packages/core/src/node/mdx/index.ts` | `boltdocsMdxPlugin()` (17) |
| `packages/core/src/node/cache.ts` | `FileCache` (53), `AssetCache` |
| `packages/core/src/node/pipeline/index.ts` | `Pipeline` class (14) |
| `packages/core/src/node/pipeline/build-pipeline.ts` | `createBuildPipeline()` (13) |
| `packages/core/src/node/plugins/plugin-types.ts` | `SecureBoltdocsPlugin` (52), `PluginLifecycleHooks` (32) |
| `packages/core/src/node/plugins/plugin-lifecycle.ts` | `PluginLifecycleManager` (13) |
| `packages/core/src/node/plugins/plugin-validator.ts` | `validatePlugins()` (28) |
| `packages/core/src/node/errors.ts` | Error classes (1-44) |
| `packages/core/src/node/schema/config.ts` | `BoltdocsConfigSchema` |
| `packages/core/src/node/schema/frontmatter.ts` | `FrontmatterSchema` (6) |
| `packages/core/src/node/cli-entry.ts` | CLI commands (25-115) |
| `packages/core/src/node/cli/dev.ts` | `devAction()` (18) |
| `packages/core/src/node/cli/build.ts` | `buildAction()` (9) |
| `packages/core/src/client/ssg/create-routes.tsx` | `createRoutes()` (29) |
| `packages/core/src/client/ssg/boltdocs-shell.tsx` | `BoltdocsShell` (70) |
| `packages/core/src/client/index.ts` | All client exports (1-38) |
| `packages/plugin-ssg/src/node/build.ts` | `build()` function, `computeClientCodeHash()` (112) |

## Common Gotchas

1. **Never use `npm` or `yarn`** — This is a pnpm workspace. `npm install` will break dependencies.

2. **`.` in React Router** means "match parent's URL path" — NOT a literal segment. When generating SSG paths, `path="."` must be resolved to the parent path (e.g., `/docs`), not `prefix + "/."`.

3. **Redirect routes reuse elements** — Fallback routes for `/docs` reuse the first matched route's `element` and `loader` instead of `<Navigate>` or `redirect()`. This avoids hydration mismatches.

4. **MDX cache is gzipped in production** — The `FileCache` compresses with gzip when `NODE_ENV=production`. In dev, compression is off by default.

5. **`computeClientCodeHash` scans the entire monorepo** — It recursively hashes all files in project root + `packages/`. This is expensive. The hash determines whether the SSG client build is skipped.

6. **Virtual modules have module-level caches** — `_routesCache`, `_searchDataCache`, `_collectionsCache`, `_directoryMetaCache` are only invalidated on file add/unlink events, NOT on content changes.

7. **Frontmatter hash check for HMR** — Content changes (body only) don't trigger route invalidation. Only frontmatter changes (detected via hash comparison) trigger full reload.

8. **Config files trigger full restart** — Changing `boltdocs.config.{js,mjs,ts}` calls `server.restart()`, not HMR.

9. **Plugin validation is strict** — Duplicate plugin names, invalid component paths (with `..`), and version mismatches throw `PluginValidationError` or `PluginCompatibilityError`.

10. **Route generation has coalescing** — Multiple concurrent calls to `generateRoutes()` share a single promise (`activeGenerationPromise`). Don't call it redundantly.

11. **`@` alias** resolves to `packages/core/src` in vitest and dev server, but NOT in production builds. Use relative imports in published code.

12. **SSG uses two sequential Vite builds** — Client build must complete before server build (server needs client manifest). This is the main production build bottleneck.

13. **`turbo.json` has irrelevant `.next/**` output pattern** — This is a Vite project, not Next.js. The pattern should be removed but currently exists.

14. **pnpm overrides are pinned** — React 19.2.5, react-router-dom ^7.0.0, etc. are overridden in root `package.json`. Don't change these without checking compatibility.
