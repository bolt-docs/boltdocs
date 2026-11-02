# Boltdocs Repository Agent Guide

## Quick Reference

1. **Package manager**: `pnpm` only. Never use `npm` or `yarn`.
2. **Code style**: Biome — single quotes, no semicolons, 2-space indent, `formatWithErrors: true`.
3. **TypeScript**: Strict mode. Use `import type` for type-only imports.
4. **Directories vs package names**: every package lives in `packages/boltdocs-<name>/`, but the **published names are unchanged** (`boltdocs`, `@bdocs/*`, `create-boltdocs`). A path change is free; a name change breaks every site.
5. **Path alias**: `@` resolves to the `src` of the package whose `vitest.config.ts` declares it — in the engine that is `packages/boltdocs-engine/src`.
6. **Before committing**: Run `pnpm run format` to auto-format with Biome.

## Monorepo Structure

Boltdocs is a React/Vite documentation framework. Monorepo managed by Turborepo + pnpm workspaces.

### Packages

| Layer | npm name | Path | Purpose |
| --- | --- | --- | --- |
| Contracts | `@bdocs/contracts` | `packages/boltdocs-contracts` | Framework-neutral types: routes, plugins, lifecycle, highlighting, search, config |
| Primitives | `@bdocs/primitives` | `packages/boltdocs-primitives` | Style-neutral UI primitives: structure, behavior, `data-*` state. No visuals |
| Runtime | `@bdocs/runtime` | `packages/boltdocs-runtime` | Browser-facing React: contexts, hooks, router entry, `createRoutes`, `BoltdocsShell` |
| Theme | `@bdocs/theme-neutral` | `packages/boltdocs-theme-neutral` | The default theme: components, native CSS, and the `surface` object the engine renders with |
| Engine | `boltdocs` | `packages/boltdocs-engine` | Node-only: CLI, config, routes, plugin lifecycle, build pipeline, dev server, Vite plugins |
| SSG | `@bdocs/ssg` | `packages/boltdocs-ssg` | Client/server Vite builds, HTML rendering, content-addressed page cache |
| Processor | `@bdocs/processor-satteri` | `packages/boltdocs-processor-satteri` | MDX compile pipeline (Sätteri) and its rehype/remark plugins |
| Grammars | `@bdocs/grammars` | `packages/boltdocs-grammars` | Vendored TextMate grammars + themes for the Shiki engine |
| Unist utils | `@bdocs/unist-utils` | `packages/boltdocs-unist-utils` | AST helpers, fence-meta parsing, highlight config normalization |
| Parser | `@bdocs/parser` | `packages/boltdocs-parser` | Zig/WASM markdown parser with cross-platform native binaries |
| Critical CSS | `@bdocs/zig-critters` | `packages/boltdocs-zig-critters` | WASM critical-CSS extractor used by `ssg.criticalCss` |
| Scaffolder | `create-boltdocs` | `packages/boltdocs-create` | Project scaffolder CLI |
| Build config | `tsdown-config` | `packages/boltdocs-tsdown-config` | Shared `tsdown` preset |
| Plugins | `@bdocs/plugin-*` | `packages/boltdocs-plugin-*` | Optional integrations — see the table below |

Plugins: `ask-ai`, `git-meta`, `image-optimizer`, `llms-text`, `math`, `mermaid`, `rss`, `sass`, `search`, `search-algolia`, `search-pagefind`, `seo`, `tailwindcss`, `unocss`.

### Workspace Dependencies

Measured from the manifests:

```text
@bdocs/contracts        (no workspace dependencies)

@bdocs/runtime          → @bdocs/contracts
@bdocs/unist-utils      → @bdocs/contracts
@bdocs/processor-satteri → @bdocs/contracts, @bdocs/unist-utils
@bdocs/ssg              → @bdocs/contracts, @bdocs/zig-critters
@bdocs/theme-neutral    → @bdocs/contracts, @bdocs/primitives, @bdocs/runtime

boltdocs (engine)       → @bdocs/contracts, @bdocs/grammars, @bdocs/parser,
                          @bdocs/processor-satteri, @bdocs/ssg, @bdocs/unist-utils
```

The engine does **not** import the UI layer: no React components, no theme, no
`@bdocs/runtime`. A theme is resolved by name (`themePackage`, default
`@bdocs/theme-neutral`) and imported at build time. Plugins that ship client UI
depend on `@bdocs/runtime` and/or `@bdocs/primitives` themselves.

### Other Directories

- `docs/` — the documentation site (`boltdocs.config.ts`), which is also the integration test bed
- `tests/` — repo-level Playwright a11y tests, benchmark fixtures, changelog fixtures
- `scripts/` — build helpers and benchmarks (`scripts/benchmarks/`, `scripts/visual/`)
- `skills/boltdocs/` — the agent skill installed by `install-ai-agents.sh`
- `assets/` — repository static assets

`packages/tests/` is **not** a package: it holds changelog fixtures, which is why
it carries no `boltdocs-` prefix.

## Code Style & Conventions

**Config**: `biome.json`

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
pnpm run format                # Format entire repo
pnpm run format:core           # Format packages/boltdocs-engine/src only
pnpm exec biome check --write  # Lint + format packages/boltdocs-engine
pnpm run lint:md               # markdownlint on every .md/.mdx
pnpm run check:boundaries      # Undeclared-import audit
```

## Documentation Content Conventions

These rules apply to every `.mdx` page under `docs/`. They keep the rendered site consistent and avoid accessibility regressions.

### One H1 per page — never repeat the frontmatter title

The default layout already renders the page title as an `<h1>` and the
`description` under it, both sourced from frontmatter. **Do not add a `# Title`
heading (or a description paragraph) to the content** — it renders as a
duplicated heading with a link icon right below the theme's own title, and it is
an accessibility failure. Content should start directly with prose or the first
`##` section.

### Unique headings per page

The OnThisPage right-rail TOC lists every `h2`–`h4` on the page. Duplicate
heading text produces duplicate TOC entries. There is a Playwright regression
test (`tests/a11y/on-this-page.spec.ts`) that fails on duplicates.

### Canonical hrefs — never hand-write locale/version prefixes

Every link (navbar, sidebar, cards, MDX) goes through `useLocalizedTo()`, which prepends the active locale and version automatically. Write **canonical, unlocalized paths**:

| Href | Kind | Notes |
| --- | --- | --- |
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

**Config**: `tsconfig.base.json` (root), `tsconfig.json` (project references, `docs` + engine), per-package `tsconfig.json`

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

- `@` → the `src` of the package that declares it in its own `vitest.config.ts`
- `boltdocs/entry` → `boltdocs-entry.tsx` (user project root)
- `boltdocs/client` → `boltdocs-client.mjs` (user project root)
- `virtual:boltdocs-*` → Virtual modules (resolved by plugin)

The engine's `vitest.config.ts` also aliases **workspace packages to their
source** (`@bdocs/theme-neutral`, `@bdocs/runtime`, `@bdocs/primitives`,
`@bdocs/contracts`, `@bdocs/plugin-search`). Those aliases are absolute paths
built with `path.resolve(__dirname, '../boltdocs-…/src')` — if a package
directory is renamed, they break **silently at collect time**, and the failure
looks like a missing dependency rather than a stale path.

### File Extensions

- Source: `.ts` (Node), `.tsx` (React components)
- Output: `.mjs` (ESM), `.cjs` (CJS), `.d.ts` / `.d.mts` (types)
- Build tool: `tsdown` with `--config-loader unrun`

## Architecture

### Contracts (`@bdocs/contracts`)

Public, framework-neutral types. No Node, Vite, React or SSG imports. Everything
else may import it; it imports nothing from the workspace.

### Primitives (`@bdocs/primitives`)

Structure, behavior and state only. **No colors, borders or sizes** are baked
into a primitive. State is exposed via `data-*` attributes that are present only
when true (`data-active`, `data-open`, `data-selected`, `data-level`,
`data-collapsible`, `data-badge`). A theme styles those states; a primitive that
ships a visual cannot be themed.

### Runtime (`@bdocs/runtime`)

The browser half: contexts (`theme-context`, `ui-context`, `routes-context`,
`config-context`, …), the routing entry (`create-routes*.tsx`, `router/`), the
shell (`BoltdocsShell` in `src/app/shell.tsx`), localized hrefs, view
transitions, and the site bridge (`registerSiteBridge`) through which
`virtual:boltdocs-*` artifacts reach the theme. No filesystem, no Vite, no
Piscina, no Sharp.

### Theme (`@bdocs/theme-neutral`)

Components + stylesheet + `surface` (the object the engine renders with). The
stylesheet is native CSS — `import '@bdocs/theme-neutral/css'` — not Tailwind
utilities: every rule is a real class in `src/styles/`, so a custom theme can
override it without matching utility classes. `src/components/` splits into:

- `ui-base/` — reusable UI (navbar, sidebar, on-this-page, search-dialog, tabs, …)
- `composition/` — layout compositions (docs-layout, heading, callout, code-block, …)
- `mdx/` — MDX-specific components and their hooks
- `internal/` — not exported to users

### Engine (`boltdocs`)

Node only: config resolution, route generation, frontmatter validation, plugin
lifecycle, build orchestration, dev-server state, invalidation, and the Vite
plugins. It exports the client-facing pieces indirectly through
`@bdocs/theme-neutral`/`@bdocs/runtime`, never by shipping components itself.

### SSG (`@bdocs/ssg`)

Consumes contracts: client build, server build, page rendering, critical CSS,
output materialization and page-cache policy.

## Plugin System

### Plugin Interface

**File**: `packages/boltdocs-engine/src/node/plugins/plugin-types.ts`

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

**File**: `packages/boltdocs-engine/src/shared/types.ts:115`

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

**File**: `packages/boltdocs-engine/src/shared/types.ts:108`

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

**File**: `packages/boltdocs-engine/src/node/plugins/plugin-validator.ts`

- Plugins validated against `SecurePluginSchema` (Zod)
- Duplicate plugin names rejected
- Version compatibility checked via `semver.satisfies()`
- Component paths validated against traversal (`..` rejected)
- Plugin ordering: `pre` → normal → `post` (via `enforce` field)

### Plugin Lifecycle Execution

**File**: `packages/boltdocs-engine/src/node/plugins/plugin-lifecycle.ts` (`PluginLifecycleManager`, line 73)

- `runHook()`: Runs hook on all plugins in order (parallel-safe via Pipeline)
- `runChain()`: Runs transform hooks sequentially, piping `params` through each plugin
- Rollback: On failure, completed steps run their `buildEnd` hook in reverse

## Virtual Modules System

**File**: `packages/boltdocs-engine/src/node/plugin/virtual-modules.ts`

All `virtual:boltdocs-*` modules are resolved by the `vite-plugin-boltdocs-virtual-modules` plugin.

| Module | Purpose |
| --- | --- |
| `virtual:boltdocs-entry` | App entry point |
| `virtual:boltdocs-client` | Client package re-export |
| `virtual:boltdocs-client-registry` | Plugin client slots/providers |
| `virtual:boltdocs-search` | Search index data |
| `virtual:boltdocs-page-source` | Raw page source for the source view |
| `virtual:boltdocs-mdx-components` | User MDX components (`mdx-components.{tsx,ts,jsx,js}`) |
| `virtual:boltdocs-layout` | User layout (`layout.{tsx,jsx}`) |
| `virtual:boltdocs-icons` | User icon registry (`icons.{tsx,jsx,ts,js}`) |

**The theme cannot read these.** They only resolve inside the engine's Vite
pipeline, so the generated artifacts reach the theme through
`registerSiteBridge()` from `@bdocs/runtime`.

**Caching**: results are cached in module-level variables and invalidated on
file add/unlink (not on content changes).

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

**File**: `turbo.json` — `build` depends on `^build` and declares `dist/**`;
`dev` is uncached and persistent; `lint`, `typecheck` and `test` depend on their
upstream counterparts.

### Build Pipeline (Production)

**File**: `packages/boltdocs-engine/src/node/pipeline/build-pipeline.ts`

```text
ConfigResolve → RouteGenerate → SEOValidate → TypeGenerate → SSGBuild → SEOWrite
```

Each step is a `PipelineStep<BuildContext>` with `execute()` and optional `rollback()`.

### SSG Build: Two Vite Builds

**File**: `packages/boltdocs-ssg/src/node/build.ts`

1. **Client build** (`viteBuild` with `manifest: true, ssrManifest: true`)
   - Produces client bundle + SSR manifest
   - Cached via `computeClientCodeHash()` — skips if hash unchanged
2. **Server build** (`viteBuild` with `ssr: ssrEntry`)
   - Produces SSR bundle for static HTML rendering
   - Uses `createStaticHandler` from react-router-dom

### Client Code Hash

**File**: `packages/boltdocs-ssg/src/node/client-hash.ts:217`

`computeClientCodeHash()` recursively scans the project root **and the workspace
packages directory** (`packages/`), using `mtime` + `size` per file. That is
expensive in a monorepo, and it is what decides whether the client build is
skipped.

### Cache System

**File**: `packages/boltdocs-engine/src/node/cache.ts` (`FileCache` line 91, `TransformCache` line 320)

- MDX results are gzipped in production (`compress: true`)
- Cache directory: `.boltdocs/` (gitignored)
- Configurable via `BOLTDOCS_CACHE_DIR`, `BOLTDOCS_NO_CACHE`, `BOLTDOCS_CACHE_COMPRESS` env vars

### Build Commands

```bash
pnpm run build           # Full Turborepo build (all packages)
pnpm run build:core      # Engine only (pnpm --filter boltdocs build)
pnpm run release         # Build + changeset publish
```

## Dev Server & HMR

### Dev Server Setup

**File**: `packages/boltdocs-engine/src/node/cli/dev.ts`

1. `resolveConfig()` loads `boltdocs.config.{js,mjs,ts}`
2. `createViteConfig()` builds the full Vite `InlineConfig` with all plugins
3. `createServer()` from `@bdocs/ssg/node` starts the dev server
4. `server.listen()` starts listening

### Dev Server Plugin

**File**: `packages/boltdocs-engine/src/node/dev-server/index.ts` (`createDevServerPlugin`, line 34)

Runs on `apply: 'serve'`: `beforeDev` hook, link-tree generation, prewarming,
middlewares, watcher and HMR setup, then `afterDev`.

### Prewarming

**File**: `packages/boltdocs-engine/src/node/dev-server/prewarm.ts` (`setupPrewarming`, line 130)

After server start, batches of 32 files are pre-transformed via
`server.transformRequest()` to warm the Vite module graph.

### HMR Handler

**File**: `packages/boltdocs-engine/src/node/dev-server/hmr-handler.ts` (`setupHmr`, line 109)

File events (`add`, `unlink`, `change`) are debounced (150 ms):

| Event | Action |
| --- | --- |
| Config file change | `server.restart()` |
| `mdx-components.{ext}` change | Invalidate `mdx-components`, full reload |
| `icons.{ext}` change | Invalidate `icons`, full reload |
| `layout.{ext}` change | Invalidate `layout`, full reload |
| File in `pages-external/` | Invalidate `entry`, full reload |
| File add/unlink (in docs/) | Invalidate routes, config, search and collections, full reload |
| `meta.json` change | Same as add/unlink |
| Content change (`.md`/`.mdx`) | Frontmatter hash check → if changed: invalidate routes; else: HMR via module invalidation |

### HMR for Content Changes

1. Compute the frontmatter hash of the changed file
2. Compare with the previous hash
3. If it changed: invalidate routes, full reload
4. If it did not: invalidate the specific Vite modules, send `boltdocs:mdx-update`

## Route Generation

**File**: `packages/boltdocs-engine/src/node/routes/index.ts` (`generateRoutes`, line 404)

### File Crawling

- Uses `fdir` for fast directory crawling
- Filters: `.md` and `.mdx` files only
- Excludes files/directories starting with `_` (except `_index.md`/`_index.mdx`)

### Route Sorting

**File**: `packages/boltdocs-engine/src/node/routes/sorter.ts` (`sortRoutes`, line 11)

- Ungrouped items come first
- Items sorted by `sidebarPosition` (or `groupPosition` for groups)
- Default position: 999
- Ties broken alphabetically by title

### Route Metadata

**File**: `packages/boltdocs-engine/src/node/routes/types.ts`

Key fields: `path`, `componentPath`, `title`, `filePath`, `group`, `groupTitle`, `locale`, `version`, `badge`, `icon`, `tab`, `collection`, `tags`, `author`, `draft`, `excerpt`, `coverImage`, `frontmatter`

### Collection Directories

- Directories named `[collection-name]/` create collection routes
- Posts within carry `collection`, `date`, `tags`, `author`, `coverImage`

### i18n & Versioning

- Locale prefixes: `/{locale}/docs/...`
- Version prefixes: `/{version}/docs/...`
- Fallback generation for missing translations

### Route Invalidation

```typescript
invalidateRouteCache()  // Clears file list, localized path cache, native docs cache
invalidateFile(path)    // Removes a specific file from the native docs cache
```

## Testing

### Per-package, not root

There is no repo-wide test config that collects packages. Each package owns a
`vitest.config.ts`; the root `vitest.config.ts` collects **only**
`scripts/**/*.test.ts`. Running `vitest` from the root will not run package
tests — use the scripts below.

### Commands

```bash
pnpm test                  # = test:all
pnpm run test:core         # Engine (pnpm --filter boltdocs test)
pnpm run test:ssg          # SSG
pnpm run test:ui           # Primitives, runtime and theme-neutral (258 tests)
pnpm run test:plugins      # Every plugin package
pnpm run test:grammars     # @bdocs/grammars
pnpm run test:search       # @bdocs/plugin-search
pnpm run test:processors   # Satteri, unist-utils, create-boltdocs, parser
pnpm run test:scripts      # Root vitest (scripts only)
pnpm run test:a11y         # Playwright accessibility tests
pnpm run test:coverage     # V8 coverage across packages/*/src
```

`@bdocs/theme-neutral`, `@bdocs/runtime` and `@bdocs/primitives` each have their
own suite and are covered by `test:ui`. `@bdocs/contracts` is types-only and has
no tests and no `vitest.config.ts`, so it must not be added to `test:all` — with
the root config it finds no files and exits non-zero.

### Test Patterns

- Test files: `**/*.test.ts` / `**/*.test.tsx` inside each package's `tests/`
- Vitest with `globals: true`; the engine uses `environment: 'jsdom'`
- `@testing-library/react` + `@testing-library/jest-dom` for components
- `@` alias for `src` imports, plus source aliases for workspace packages

## Security Model

### Error Hierarchy

**File**: `packages/boltdocs-engine/src/node/errors.ts`

```text
SecurityViolationError (base)
├── PathTraversalError       # Directory traversal attempts
├── EncodingSecurityError    # Malicious character encoding
└── ValidationError          # Schema/size validation failures
```

### Security Constants

**File**: `packages/boltdocs-engine/src/node/security/constants/index.ts`

```typescript
MAX_PATH_LENGTH = 260
ALLOWED_PATH_CHARS = /^[a-zA-Z0-9\-_/.()[\]]+$/
MAX_FRONTMATTER_SIZE = 10 * 1024  // 10KB
```

### Frontmatter Validation

**File**: `packages/boltdocs-engine/src/node/schema/frontmatter.ts`

Uses `z.looseObject()` — validates known fields, passes through unknown fields.

Known fields: `title`, `description`, `sidebarPosition`, `sidebarLabel`, `sidebarHidden`, `badge`, `icon`, `date`, `lastUpdated`, `groupTitle`, `groupPosition`, `seo`, `tags`, `author`, `draft`, `excerpt`, `coverImage`, `category`, `order`

### Config Validation

**File**: `packages/boltdocs-engine/src/node/schema/config.ts`

Full Zod schema for `BoltdocsConfig` including theme, `themePackage`, i18n,
versions, plugins, security, robots, social links and integrations.

### Path Security

- `normalizePath()`: Converts `\` to `/` for cross-platform consistency
- `sanitizeFilename()`: Removes dangerous characters
- `ALLOWED_PATH_CHARS` regex: Only alphanumeric, `-`, `_`, `/`, `.`, `()`, `[]`

## Key File Reference

| File | Key Functions/Lines |
| --- | --- |
| `packages/boltdocs-engine/src/node/index.ts` | `createViteConfig()` (172) |
| `packages/boltdocs-engine/src/node/config.ts` | `resolveConfig()` (188), `DEFAULT_THEME_PACKAGE` re-export (40) |
| `packages/boltdocs-engine/src/node/theme-package.ts` | `DEFAULT_THEME_PACKAGE` (14), `resolveThemePackage()` |
| `packages/boltdocs-engine/src/node/routes/index.ts` | `generateRoutes()` (404) |
| `packages/boltdocs-engine/src/node/routes/sorter.ts` | `sortRoutes()` (11) |
| `packages/boltdocs-engine/src/node/plugin/index.ts` | `boltdocsPlugin()` (263), Sätteri MDX wiring (909) |
| `packages/boltdocs-engine/src/node/plugin/virtual-modules.ts` | `createVirtualModulesPlugin()` (595) |
| `packages/boltdocs-engine/src/node/dev-server/index.ts` | `createDevServerPlugin()` (34) |
| `packages/boltdocs-engine/src/node/dev-server/hmr-handler.ts` | `setupHmr()` (109) |
| `packages/boltdocs-engine/src/node/dev-server/prewarm.ts` | `setupPrewarming()` (130) |
| `packages/boltdocs-engine/src/node/mdx/highlighter.ts` | `highlight()`, `ensureLanguage()`, `RegexEngineKind` |
| `packages/boltdocs-engine/src/node/mdx/shiki-adapter.ts` | `ShikiAdapter`, `getShikiAdapter()` |
| `packages/boltdocs-engine/src/node/highlight/registry.ts` | Highlighter SPI: `getCodeHighlighterAdapter()`, `registerHighlighter()`, `registerPluginHighlighter()`, `prewarmHighlighter()` |
| `packages/boltdocs-processor-satteri/src/node/satteri-plugins/rehype-shiki-plugin.ts` | `satteriRehypeCodeHighlightPlugin()`, per-worker highlight cache |
| `packages/boltdocs-engine/src/node/cache.ts` | `FileCache` (91), `TransformCache` (320) |
| `packages/boltdocs-engine/src/node/pipeline/index.ts` | `Pipeline` class |
| `packages/boltdocs-engine/src/node/pipeline/build-pipeline.ts` | `createBuildPipeline()` (37) |
| `packages/boltdocs-engine/src/node/plugins/plugin-types.ts` | `SecureBoltdocsPlugin` |
| `packages/boltdocs-engine/src/shared/types.ts` | `PluginContext` (108), `PluginLifecycleHooks` (115) |
| `packages/boltdocs-engine/src/node/plugins/plugin-lifecycle.ts` | `PluginLifecycleManager` (73) |
| `packages/boltdocs-engine/src/node/plugins/plugin-validator.ts` | `validatePlugins()` (70) |
| `packages/boltdocs-engine/src/node/cli-entry.ts` | CLI commands |
| `packages/boltdocs-engine/src/node/cli/dev.ts` | `devAction()` |
| `packages/boltdocs-engine/src/node/cli/build.ts` | `buildAction()` |
| `packages/boltdocs-ssg/src/node/build.ts` | `build()` |
| `packages/boltdocs-ssg/src/node/client-hash.ts` | `computeClientCodeHash()` (217) |
| `packages/boltdocs-runtime/src/app/create-routes.tsx` | `createRoutes()` (64) |
| `packages/boltdocs-runtime/src/app/shell.tsx` | `BoltdocsShell` (131) |
| `packages/boltdocs-theme-neutral/src/index.ts` | Theme exports (`DocsLayout`, `DocPage`, `surface`, primitives re-exports) |
| `packages/boltdocs-theme-neutral/src/surface.ts` | `surface` — what the engine renders the theme with |

## Common Gotchas

1. **Never use `npm` or `yarn`** — This is a pnpm workspace. `npm install` will break dependencies.

2. **A renamed package directory does not rename the package.** The published
   names are load-bearing (`boltdocs`, `@bdocs/*`); the directory is not. The
   reverse is also true: renaming a directory requires updating every absolute
   path built from it — `vitest.config.ts` aliases, `join(ROOT, 'packages', …)`
   segments, `.gitignore` entries and CI path filters. A stale alias fails at
   *collect* time and reads like a missing dependency.

3. **`.` in React Router** means "match parent's URL path" — NOT a literal segment. When generating SSG paths, `path="."` must be resolved to the parent path (e.g., `/docs`), not `prefix + "/."`.

4. **Redirect routes reuse elements** — Fallback routes for `/docs` reuse the first matched route's `element` and `loader` instead of `<Navigate>` or `redirect()`. This avoids hydration mismatches.

5. **MDX cache is gzipped in production** — The cache compresses with gzip when `NODE_ENV=production`. In dev, compression is off by default.

6. **`computeClientCodeHash` scans the entire monorepo** — It recursively hashes all files in the project root + `packages/`. This is expensive, and it decides whether the SSG client build is skipped.

7. **Virtual modules have module-level caches** — only invalidated on file add/unlink, NOT on content changes.

8. **Frontmatter hash check for HMR** — Content changes (body only) don't trigger route invalidation. Only frontmatter changes trigger a full reload.

9. **Config files trigger full restart** — Changing `boltdocs.config.{js,mjs,ts}` calls `server.restart()`, not HMR.

10. **Plugin validation is strict** — Duplicate plugin names, invalid component paths (with `..`), and version mismatches throw `PluginValidationError` or `PluginCompatibilityError`.

11. **Route generation has coalescing** — Concurrent calls share a single promise (`activeGenerationPromise`). Don't call it redundantly.

12. **`@` alias** resolves to a package's `src` in vitest and the dev server, but NOT in production builds. Use relative imports in published code.

13. **SSG uses two sequential Vite builds** — The client build must finish before the server build (the server needs the client manifest).

14. **pnpm overrides are pinned** — React 19.2.5, `react-router-dom` ^7, Vite 8.3.5, etc. are overridden in the root `package.json`. Don't change them without checking compatibility.

15. **The theme is native CSS, not Tailwind.** `@bdocs/theme-neutral` has no
    Tailwind dependency; its rules live in `src/styles/` and are shipped as
    `@bdocs/theme-neutral/css`. Utilities in theme components would be invisible
    to a project that does not install Tailwind.

16. **The highlighter is a compile-time cost, not a runtime one.** Shiki never
    ships to the browser; `data-highlighted-html` carries the rendered markup.
    A light/dark theme pair runs the TextMate grammar **twice** (once per
    theme) — measured at 18.1 ms against 9.7 ms on a 39-line block. Single-theme
    sites halve the highlighting cost by construction.
