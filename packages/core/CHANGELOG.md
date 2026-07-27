# boltdocs

## 3.2.2

### Patch Changes

- Updated dependencies [[`9c570fe`](https://github.com/bolt-docs/boltdocs/commit/9c570fe616da29fde6591359e9543de79b9454e9)]:
  - @bdocs/ssg@0.3.1

## 3.2.1

### Patch Changes

- [`4a94958`](https://github.com/bolt-docs/boltdocs/commit/4a94958e480398346001a66d866ecce33d69c5e9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix SSR build errors by externalizing react-router-dom during server-side rendering. Framework aliases for react-router-dom, react-helmet-async, and @bdocs/ssg are now applied only to client builds, preventing duplicate router contexts when @bdocs/ssg provides the Router while BoltdocsShell consumes it.

## 3.2.0

### Minor Changes

- [`6904710`](https://github.com/bolt-docs/boltdocs/commit/6904710df233ff29193adcbb746c4d16011255d3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat(ask-ai): multi-provider support, dev-mode token chip, `useConfig`-driven client config.

  **Provider preset table** — 12 providers wired up via `provider: '<name>'` option:

  | `provider`   | Default `baseURL`                | Default model                    | Env var                |
  | ------------ | -------------------------------- | -------------------------------- | ---------------------- |
  | `openai`     | `https://api.openai.com/v1`      | `gpt-4o-mini`                    | `OPENAI_API_KEY`       |
  | `anthropic`¹ | _(unset, see note)_              | `claude-3-5-haiku-latest`        | `ANTHROPIC_API_KEY`    |
  | `gemini`¹    | _(unset, see note)_              | `gemini-2.0-flash-exp`           | `GEMINI_API_KEY`       |
  | `mistral`    | `https://api.mistral.ai/v1`      | `mistral-small-latest`           | `MISTRAL_API_KEY`      |
  | `cohere`     | `https://api.cohere.ai/v1`       | `command-r-plus`                 | `COHERE_API_KEY`       |
  | `deepseek`   | `https://api.deepseek.com/v1`    | `deepseek-chat`                  | `DEEPSEEK_API_KEY`     |
  | `groq`       | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant`           | `GROQ_API_KEY`         |
  | `openrouter` | `https://openrouter.ai/api/v1`   | `openai/gpt-4o-mini`             | `OPENROUTER_API_KEY`   |
  | `together`   | `https://api.together.xyz/v1`    | `meta-llama/Llama-3-70b-chat-hf` | `TOGETHER_API_KEY`     |
  | `ollama`     | `http://localhost:11434/v1`      | `llama3.2`                       | `OLLAMA_API_KEY`       |
  | `azure`¹     | _(required)_                     | `gpt-4o-mini`                    | `AZURE_OPENAI_API_KEY` |
  | `custom`¹    | _(required)_                     | `gpt-4o-mini`                    | `OPENAI_API_KEY`       |

  ¹ Anthropic, Gemini, Azure, and Custom providers require a user-supplied `baseURL` (e.g. OpenRouter, LiteLLM, Cloudflare AI Gateway as an OpenAI-compatible proxy). The plugin only speaks the OpenAI Chat Completions wire format.

  **New options:**
  - `provider` — provider preset name (default `'openai'`).
  - `systemPrompts` — per-provider system-prompt override map. Matching provider key wins over global `systemPrompt`.
  - `devMode` — when `true`, the chat UI renders a token-consumption chip (`provider/model`, prompt/completion/total tokens, elapsed ms) below each assistant response. Auto-enabled when `process.env.NODE_ENV !== 'production'`.

  **Client config refactor:** `useAskAi` now reads runtime options via the `useConfig()` hook and the new plugin `metadata` field, replacing the previous `virtual:boltdocs-config` import. The `metadata?: Record<string, unknown>` field was added to both `BoltdocsPlugin` and `SecureBoltdocsPlugin` in core to make this type-safe.

  **Security:** `SECURITY.md` rewritten to document all 12 providers, the dev-mode chip, and the new `metadata` exposure contract.

  **Other fixes:**
  - `handler.ts`: API key lookup now uses `providerEnvKey` instead of hardcoded `OPENAI_API_KEY`.
  - `ServerResponse` import moved from `vite` to `node:http`.
  - Adapter `eventToSse` switches now have a default case (TS2366).
  - Middleware narrows `question` to `string` via local `safeQuestion` (TS2322 fix).

- [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Reduce package weight for downstream consumers.

  `icons-dev.tsx` is split into `icons-prod.tsx` (eager social/nav icons) and `mdx/lang-icons.tsx` (lazy-loaded chunk for MDX code blocks) — pages without code blocks now ship zero bytes of language icons. `react-aria-components` was promoted from `dependencies` to a **required** peer; `sharp` and `svgo` are removed from core (already peers of `@bdocs/plugin-image-optimizer`).

  Public API surface is unchanged — all exports from `'boltdocs'`, `'boltdocs/client'`, `'boltdocs/server'`, `'boltdocs/primitives'`, and `'boltdocs/mdx'` resolve to the same symbols as 3.1.x.

  Sites without `@bdocs/plugin-image-optimizer` save ~35 MB of unpacked native binaries. Sites that use it are unaffected.

  **CI / lockfile-strict setup:** if your CI hard-fails on the `react-aria-components` peer advisory, use `either` `.npmrc` `or` `.pnpmrc` (not both) to whitelist the documented peer — never blanket-disable with `legacy-peer-deps=true`. Full recipes in the [upgrade guide](https://boltdocs.com/docs/guides/upgrading-3-2).

  The dependency contract is pinned by a new `packages/core/tests/package-shape.test.ts` (8 assertions) so future PRs can't silently re-bloat.

- [`46e288d`](https://github.com/bolt-docs/boltdocs/commit/46e288d485bf50ae226a3b3c70c0a93040b8ae0c) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Boltdocs 3.2.0 — Nitro Phase 1 performance optimizations

  ### Cache & Build Performance
  - **SSR output consolidated**: Moved from `.vite-react-ssg-temp/` to `.boltdocs/build/ssr/` — all build artifacts now live under a single `.boltdocs/` directory
  - **Server build skip preserved**: SSR output no longer deleted when client code hasn't changed, making warm builds skip the expensive SSR Vite bundle (~40s saved)
  - **Mtime cache in memory**: `getFileMtime()` now uses an in-memory TTL cache (2s) instead of `fs.statSync()` on every call — 5.9x faster for repeated stat calls
  - **Client hash single stat**: `computeClientCodeHash()` reduced from 3 stat calls per file to 1 — 66% fewer syscalls
  - **Hash meta persistence**: `hash-meta.json` stores file count + last mtime for fast cache validation without full directory scans
  - **Dev gzip skipped**: `TransformCache` no longer gzips cache shards in dev mode

  ### MDX & Routes
  - **MDX cache key for dev**: Uses file path + mtime instead of content hash in dev mode — cache survives restarts when files haven't changed
  - **Bounded route parsing**: `Promise.all` replaced with `runWithConcurrency(32)` to prevent memory pressure and I/O contention
  - **docCache loaded flag**: `docCache.load()` skips disk read when already in memory

  ### Dev Server & HMR
  - **HMR O(1) module graph lookup**: Pre-built lowercase index replaces brute-force O(N) scan for faster content edits
  - **Prewarming with route priority**: Index pages and getting-started are prewarmed first; 150ms delay to avoid CPU contention with first page request

  ### Pipeline & Syntax Highlighting
  - **Pipeline parallel steps**: SEO validation and type generation run concurrently via `addParallelSteps()`
  - **Pipeline timing logs**: Per-step timing reported after build completion
  - **Critical CSS concurrency**: Beasties processor runs at `concurrency: min(cpus, 4)` instead of 1
  - **Shiki WASM engine**: Oniguruma WASM engine replaces JavaScript regex — 13% faster syntax highlighting

- [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Phase 1 of the new plugin API. The unist/mdast/hast utilities that used to
  live in `boltdocs/node/plugins/plugin-utils` (visit helpers, builders,
  h-properties, class-list helpers) and the shiki-internal `parseMetaString`
  move into a new public package: **`@bdocs/unist-utils`**.

  For `boltdocs` core (no public-API impact): internal code now imports
  directly from `@bdocs/unist-utils`. The old paths
  (`boltdocs/node/plugins/plugin-utils` through barrel,
  `packages/core/src/node/mdx/types`) keep working as a back-compat shim.

  `parseMetaString` and the `ParsedMeta` interface also moved; shiki-adapter
  re-imports them from the new package and the `__raw` field is now typed
  as `string | undefined`.

  The new package is `sideEffects: false`, ships with strict types end-to-end
  and is published under the standard Boltdocs organisation namespace so
  external plugin authors can adopt it directly. Migration notes for plugin
  authors live in `packages/unist-utils/README.md`.

- [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Phase 2 of the new plugin API: enrich `PluginContext` with four
  new APIs every lifecycle hook receives:

  | New ctx field    | Type                      | What it does                                                                                                                                     |
  | ---------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `caches`         | `PluginCachesAPI`         | Functional wrappers around the core's `TransformCache`, `FileCache`, and a fresh per-namespace LRU. Never leaks implementation.                  |
  | `diagnostics`    | `PluginDiagnosticsAPI`    | Structured `report()` channel — drain via `list()` from reporters/dev-server overlay/CI.                                                         |
  | `paths`          | `PluginPathsAPI`          | `resolveDocs`, `resolveAsset`, `safeFileURL` — all reject paths that escape the workspace boundary.                                              |
  | `virtualModules` | `PluginVirtualModulesAPI` | Plugins declare `virtual:<plugin>/<id>` modules without authoring a full Vite plugin. The core Vite plugin loads them in a single dispatch path. |

  ### Migration for plugin authors

  ```ts
  // Cache something without reaching into core internals
  ctx.caches
    .transform('my-plugin-rewrites')
    .set('foo', 'bar')

  // Surface a structured warning the dev server can render in an overlay
  ctx.diagnostics.report(
    'warn',
    'MY_PLUGIN_CONFIG',
    'config.foo is missing — using the default',
    { filePath: ctx.docsDir + '/config.ts' },
  )

  // Avoid hand-rolled path joins
  const link = ctx.paths.resolveDocs('assets', 'banner.png')

  // Expose a custom virtual module to clients
  ctx.virtualModules.add(
    'virtual:@my-plugin/runtime-config',
    () => `export default ${JSON.stringify({ ... })};`,
  )
  ```

  Plugin authors do NOT need any extra dependency — `ctx.*` is enriched
  inside Boltdocs core.

  ### Internal changes (no public surface for users)
  - `packages/core/src/node/plugins/plugin-context.ts` — new module
    implementing the four APIs.
  - `PluginLifecycleManager.createContext()` — extended to inject them.
  - `packages/core/src/node/plugin/virtual-modules.ts` — `resolveId` and
    `load` branches for plugin-declared virtuals. Two public exports
    added: `invalidatePluginVirtualModules()` (re-export of
    `invalidateVirtualModulesCache`).
  - New `__resetPluginContextStateForTests()` test helper is exported
    from `plugin-context.ts` to clear diagnostic queue and
    plugin-virtual-map between test runs.

  ### Reserved namespace

  Plugin virtual modules registered under the `virtual:boltdocs-` prefix
  are rejected at registration time — the prefix is reserved for core.
  Plugin authors should prefix their ids with the plugin name
  (`virtual:@my-plugin/...` or `virtual:my-plugin-...`).

  ### Out of scope (called out, parked for a later phase)
  - The `eager` flag on `add()` is accepted but not yet wired into the
    generated `boltdocs-entry.tsx`. Phase 7 (MDX transformer API) or a
    later Phase will pick it up to auto-inject plugin virtual imports.
  - The diagnostics queue is process-local. For multi-instance
    deployments front it with a remote sink (file/process-tracker/
    OTEL). The interface stays stable across sinks.

- [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Phase 7 of the new plugin API: transform middleware pipeline and lazy slot
  loading.

  ### Transform Middleware API

  Plugins can now register standalone transform middleware via
  `BoltdocsPlugin.middleware` or programmatically via `ctx.middleware.add()`.

  Each middleware has its own `name` and optional `enforce` ordering (`pre` |
  `post`). Middleware transform functions receive the same enriched params as
  lifecycle hooks and support `__signal: 'skip'` / `__signal: 'break'`:

  ```ts
  const plugin: BoltdocsPlugin = {
    name: "my-plugin",
    middleware: [
      {
        name: "my-plugin:html",
        transformHtml: async (_ctx, { html, path }) => {
          return { html: html.replace(/foo/g, "bar") };
        },
      },
    ],
  };
  ```

  The `runMiddlewareChain()` method on `PluginLifecycleManager` collects
  both statically-declared and programmatically-registered middleware, sorts
  by `enforce`, and runs them in sequence. Each middleware gets a generic
  `PluginContext` with all standard APIs (caches, diagnostics, paths, slots,
  virtualModules).

  ### Slot Lazy Loading

  Slot declarations now accept `lazy?: boolean`. When `true`, the slot
  component is wrapped in `<Suspense>` with a pulse-animated fallback
  placeholder. The `slotLazyFlags` parallel map is emitted alongside
  `slotRegistry`, `slotConditions`, and `slotSsrFlags`:

  ```ts
  const plugin: BoltdocsPlugin = {
    name: "my-plugin",
    clientEntry: "@scope/plugin/client",
    slots: [{ id: "right-rail", export: "HeavyWidget", lazy: true }],
  };
  ```

  Lazy components are rendered inside `<Suspense fallback={<SlotFallback />}>`
  in the default layout. The `SlotWithSSR` interface now carries a `lazy`
  boolean field.

  ### Internal changes
  - `packages/core/src/shared/types.ts` — `PluginTransformMiddleware`,
    `PluginMiddlewareAPI`, `lazy?: boolean` on `SlotDeclaration`,
    `middleware` field on `BoltdocsPlugin`, `middleware` field on
    `PluginContext`
  - `packages/core/src/node/plugins/plugin-types.ts` — `middleware` on
    `SecureBoltdocsPlugin`
  - `packages/core/src/node/plugins/plugin-context.ts` —
    `middlewareRegistry`, `createPluginMiddlewareAPI()`,
    `invalidateMiddlewareCache()`, reset helper updated
  - `packages/core/src/node/plugins/plugin-lifecycle.ts` —
    `runMiddlewareChain()`, `createGenericContext()`, `middleware` wired
    into context factories
  - `packages/core/src/node/plugin/layout-slots.ts` — `lazy` in
    `SlotDeclarationSchema`, emits `slotLazyFlags` parallel map
  - `packages/core/src/node/schema/config.ts` — `lazy` and `middleware`
    added to config schemas
  - `packages/core/src/client/hooks/use-slot-registry.ts` —
    `slotLazyFlags` import, `lazy` field on `SlotWithSSR`
  - `packages/core/src/client/components/docs-layout-default.tsx` —
    `<Suspense>` wrapping for lazy slot items, `SlotFallback` component
  - `packages/core/src/client/virtual.d.ts` — `slotLazyFlags` declaration
  - `packages/core/tests/slots/layout-slots-generator.test.ts` — 3 new lazy
    flag tests

### Patch Changes

- [`64fe83a`](https://github.com/bolt-docs/boltdocs/commit/64fe83a2fc1b241f39ac7032bb38c7439041508c) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix mermaid pages having extra scroll space at the bottom
  - Fix body scroll bug: changed `min-height: 100%` to `height: 100%; overflow: hidden` on html/body in reset.css to prevent the browser scrollbar from appearing on all pages
  - Mermaid SVG cleaning now uses DOMParser to only strip sizing attributes from the root `<svg>` element, preserving inner element styles (transforms, font-size) that mermaid uses for node positioning
  - Added `not-prose` class to mermaid wrapper to prevent Tailwind typography plugin from adding margins to the SVG
  - Added `margin: 0 !important` to mermaid SVG CSS as additional safety
  - Added `overflow: hidden` to the root SVG element via cleanSvg
  - Moved `<style>` tag inside the mermaid container div to avoid prose layout interference

- Updated dependencies [[`46e288d`](https://github.com/bolt-docs/boltdocs/commit/46e288d485bf50ae226a3b3c70c0a93040b8ae0c), [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a)]:
  - @bdocs/ssg@0.3.0
  - @bdocs/unist-utils@0.2.0

## 3.1.0

### Minor Changes

- [`ed84f8a`](https://github.com/bolt-docs/boltdocs/commit/ed84f8af1809ae7b33ad4e6cd6468786dd19a947) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Feature:
  - **`PluginContext.outDir`** — new readonly property exposing the build output directory (e.g., `'dist/'`) to plugin lifecycle hooks, eliminating the need for plugins to hardcode output paths
  - **`--turbo` mode** for `boltdocs build` — Sätteri-powered build pipeline with native WASM parsing, critical CSS extraction, and Shiki syntax highlighting
    - Available via CLI: `boltdocs build --turbo`
    - Native WASM MDX parser (satteri) replaces @mdx-js/rollup for faster compilation
    - Critical CSS extraction via zig-critters (WASM) removes unused CSS
    - Shiki syntax highlighting with dual light/dark themes
    - Remark/rehype plugin adapter layer supports standard unified plugins (e.g. mermaid)
    - Fallback to standard MDX compiler if satteri fails
  - **Collections hooks API** — simplified hooks for collection data access
    - `usePosts(collection?)` — defaults to `"blog"`, returns all filtered posts
    - `usePost()` — reads current post from context inside `post.tsx`
    - `useRecentPosts(collection?, count?)` — defaults to `"blog"` with count of 5
    - Removed `useCollectionList` (was redundant)
  - **Feature Flags & Drafts** — control page visibility per environment
    - `drafts` config: `{ visible?: boolean, environments?: string[] }` — control draft visibility
    - `featureFlags` config: `Record<string, boolean | string>` — define flags, pages declare required flags
    - Draft badge in navbar when viewing draft pages
    - `BOLTDOCS_DRAFTS=true` env var to force draft visibility
  - **PostHog integration** — built-in analytics support for [PostHog](https://posthog.com/)
    - Config: `integrations.analytics.posthog.apiKey` (required), `host` (optional, defaults to US cloud)
    - Session recording and autocapture off by default (opt-in via config)
    - EU cloud support: `host: 'https://eu.i.posthog.com'`
    - Injects PostHog JS snippet into `<head>` at build time (production only)
    - Client-side detection via `window.posthog` in `useAnalytics()` hook

  Fixed:
  - **Locale switching bug**: Switching languages on collection pages (e.g., `/blog`) now correctly navigates to the localized version (e.g., `/es/blog`) instead of redirecting to `/docs`
  - **Vercel analytics script fix**: `vercel.analytics` and `vercel.speedInsights` now default to `true` if not specified in config, preventing accidental omission of analytics scripts
  - Native parser binary path lookup now includes `bdocs-parser` as a local fallback
  - Removed `build:wrapper` script from `zig-critters` package.json (was broken)
  - Fixed `main` field in `zig-critters/package.json` to point to `wasm/index.mjs`
  - **Critical regex fix**: `__staticRouterHydrationData` script removal regex was crossing `</script>` boundaries, eating the entire HTML structure (missing `<body>`, `</head>`, `id="root"`). Added negative lookahead `(?!<\/script>)` to prevent matching across script tags.
  - **Locale bug fix**: `DefaultCollectionList` now uses `usePosts()` which filters by current locale/version instead of `useLoaderData()` which bypassed filtering
  - **Turbo mode fixes**: Shiki syntax highlighting now produces correct HTML with merged class attributes; CSS parser handles escape sequences and edge cases in selectors; WASM memory model uses arena allocation for reliability
  - **`--turbo` performance fixes**: Fixed 5 issues causing turbo+cache to be slower than default mode:
    - Server build now correctly skips when client code is unchanged (was always running)
    - `computeClientCodeHash` no longer scans monorepo directories (packages/, scripts/, etc.)
    - Beasties critical CSS engine now skipped in turbo mode (uses zig-critters only)
    - Config resolution no longer runs twice in build pipeline
    - Turbo flag now propagated through entire pipeline to `generateRoutes`
  - **`useLocalizedTo` home link fix**: `site:/` now resolves to `/${activeLocale}` instead of bare `/` when i18n is enabled, ensuring the navbar home button stays in the current locale
  - **`useI18n` collection locale switching fix**: Switching locale from a blog post page (`/blog/en/post`) now correctly produces `/blog/es/post` instead of `/en/blog/es/post`
  - **`useI18n` collection list locale switching fix**: Switching locale from a collection root page (e.g., `/blog`) no longer navigates away — collection root URLs are locale-independent
  - **SSG SEO meta tags fix**: Blog post pages and other content pages now correctly render per-page `<title>`, `og:title`, `og:description`, and `og:image` meta tags in the static HTML. Previously, react-helmet-async's `HelmetProvider` was not populating the helmet context because `isDocument` evaluated to `true` in the SSG context (jsdom active). Fixed by forcing `HelmetProvider.canUseDOM = false` and using synchronous `renderToString` to guarantee Helmet lifecycle methods complete before HTML is serialized.
  - **Duplicate meta tags cleanup**: Removed redundant generic `og:title`, `og:description`, `og:image`, `twitter:*`, `og:type`, `og:url`, `canonical`, and `<title>` from `injectHtmlMeta()`. These were duplicates of what Helmet renders per-page via `data-rh` attributes. Each page now has a single set of SEO meta tags managed by react-helmet-async.
  - **Beasties disabled**: Critical CSS inlining via Beasties is now disabled by default. HTML pages no longer contain ~37 KB of inlined `<style>` tags. CSS loads once via external `<link>` and is cached by the browser. Reduces total HTML output by ~7.3 MB across all pages.
  - **Duplicate `crossorigin` attribute fixed**: The regex that adds `crossorigin` to `<link rel="stylesheet">` now uses a negative lookahead to avoid duplicating the attribute when it's already present.
  - **Duplicate EN locale removed**: `generateI18nFallbacks()` now skips the default locale when generating fallback routes. Previously, English content was duplicated at both root level (`/docs/api/cli`) and locale-prefixed (`/docs/en/api/cli`), resulting in ~8 MB of identical HTML files.
  - **Inline code styling fix**: Added missing styles for inline `<code>` elements (backtick text). Previously, inline code rendered as plain unstyled text with no visual distinction. Now applies background, terracotta text color, padding, border-radius, and monospace font using the existing `--color-code-bg` and `--color-code-text` theme variables.
  - **`useLocalizedTo` default locale prefix fix**: Links like `/docs/guides` no longer incorrectly get prefixed with the default locale (e.g., `/docs/en/guides`). The hook now skips adding the locale prefix when `activeLocale === defaultLocale`, matching the behavior of the route generation system. Also fixes `site:/` root links for the default locale.
  - **Browser tab title fix**: The `<title>` tag now renders correctly in the browser tab. Previously, `helmet-compat.tsx` unconditionally set `HelmetProvider.canUseDOM = false`, preventing Helmet from updating `document.title`. Now the flag is only set during SSG rendering (via `__BOLTDOCS_SSG_RENDERING__` global), allowing Helmet to manage the title on client-side navigation.

### Patch Changes

- Updated dependencies [[`1e726e1`](https://github.com/bolt-docs/boltdocs/commit/1e726e1993d401120a4611d41baf95b247ac34da), [`efd4872`](https://github.com/bolt-docs/boltdocs/commit/efd4872b34502ed06e9c98b20f2e0577c754f683)]:
  - @bdocs/parser@1.1.0
  - @bdocs/ssg@0.2.0

## 3.0.2

### Patch Changes

- [`2b98bc8`](https://github.com/bolt-docs/boltdocs/commit/2b98bc8c0dc12fe37d8889c15c219cfdea84406a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: filter collections and search by locale/version with default fallback
  - Add `locale` and `version` fields to `CollectionPost` interface
  - Filter `usePosts` results by current locale and version, falling back to config defaults
  - Fix search to match routes against default locale/version when not explicitly set
  - Include locale and version in collection virtual module data

- [`e5225e5`](https://github.com/bolt-docs/boltdocs/commit/e5225e5678b8e046dadb745010becf9bf652973e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve SSG build and pnpm 10+ install failures
  - Remove `react-fast-compare` from SSR external list to fix `ERR_MODULE_NOT_FOUND` during SSG builds (it's a CJS-only transitive dep of `react-helmet-async` that can't be resolved from pnpm's strict node_modules)
  - Add `pnpm.onlyBuiltDependencies` to `create-boltdocs` templates (base + i18n) so `pnpm install` works out of the box with pnpm 10+ without requiring manual `pnpm approve-builds`

## 3.0.1

### Patch Changes

- Updated dependencies [[`3f21800`](https://github.com/bolt-docs/boltdocs/commit/3f21800f3738550e85b8b84155707c473abcd54c)]:
  - @bdocs/plugin-image-optimizer@0.2.1

## 3.0.0

### Major Changes

- [`3cc3b45`](https://github.com/bolt-docs/boltdocs/commit/3cc3b451e59f533910b11fe69452f6d2720a2f0d) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: Boltdocs v3.0.0 - Native Parser, Vercel Analytics, Giscus, and More

  ## Native Parser Acceleration (@bdocs/parser)
  - Zig-compiled binary for markdown parsing with WASM fallback
  - 5-6x faster than JS parser (10.5x on 75-file dataset)
  - Cold start reduced from 3.67s to 349ms (90.5% reduction)
  - Cross-platform binaries: Linux x64/ARM64, macOS x64/ARM64, Windows x64
  - Auto-download via postinstall script from GitHub Releases

  ## Vercel Analytics + Speed Insights
  - Zero-config integration via `integrations.vercel.analytics` and `integrations.vercel.speedInsights`
  - Scripts injected only in production builds
  - Full documentation in English and Spanish

  ## Giscus Comment System
  - Complete component with theme sync (dark/light)
  - Configurable via `integrations.feedback.giscus`
  - Support for repo, category, mapping, reactions, custom themes
  - Full documentation in English and Spanish

  ## Custom Feedback System
  - GitHub Discussions-powered feedback
  - Middleware for dev/preview environments
  - Adapters for Vercel, Netlify, AWS, and Web platforms
  - Full documentation in English and Spanish

  ## Ask AI Plugin Overhaul
  - Complete handler and adapter rewrite
  - New sidebar panel + floating bubble UI
  - Dedicated MarkdownRenderer component
  - Comprehensive test suite (adapters, handler, Ollama integration)
  - SSE streaming with batching and AbortSignal support

  ## UI/UX Improvements
  - Card component: mouse spotlight effect
  - Navbar: Ask AI button integration
  - Search: Cmd+J shortcut, result highlighting
  - Tabs: SVG icon sanitization
  - Theme context: dual-package hazard fix
  - Breadcrumbs: typed routing

  ## SEO/Meta Improvements
  - OG image resolution with siteUrl
  - Canonical URLs
  - Structured SEO tags
  - Google search engine verification tags
  - Twitter card dynamic selection

  ## Cache System Refactor
  - TransformCache with LRU + gzipped shards
  - BackgroundQueue for async persistence
  - Image optimizer cache with stale pruning

  ## Dev Server/HMR Improvements
  - Link tree regeneration on file events
  - boltdocs:config-update custom event
  - Case-insensitive module invalidation

  ## Node 26+ Compatibility
  - DEP0205 warning suppression in CLI

- [`bbd7954`](https://github.com/bolt-docs/boltdocs/commit/bbd79543b8a8dbe17695c68e1791a2e38607ab9c) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Restructure integrations config into sections (breaking change)

  The `integrations` configuration has been reorganized into logical sections:
  `analytics`, `search`, and `feedback` to improve clarity and extensibility.

  **Migration guide:**

  ```diff
   integrations: {
  -  ga4: { measurementId: 'G-XXXXX' },
  -  gtm: { tagId: 'GTM-XXXXX' },
  -  algolia: { appId: '...' },
  -  feedback: { custom: { ... }, giscus: { ... } },
  +  analytics: {
  +    ga4: { measurementId: 'G-XXXXX' },
  +    gtm: { tagId: 'GTM-XXXXX' },
  +    vercel: { analytics: true, speedInsights: true },
  +  },
  +  search: {
  +    algolia: { appId: '...' },
  +  },
  +  feedback: {
  +    custom: { ... },
  +    giscus: { ... },
  +  },
   }
  ```

  **New features included:**
  - Vercel Analytics & Speed Insights support (`integrations.analytics.vercel`)
  - Giscus comments component (`integrations.feedback.giscus`)
  - Google Search Console verification support (`seo.verification.google`, `bing`, `yandex`, `pinterest`, `facebook`)

  **Fixes included:**
  - External pages (e.g. `/showcase`, `/about`) are now included in
    `link-tree.json` and `types.d.ts` route path generation
  - Link primitive `href` props now use `BoltdocsRoutePathWithFallback`
    for TypeScript autocompletion of known routes

### Patch Changes

- Updated dependencies [[`3cc3b45`](https://github.com/bolt-docs/boltdocs/commit/3cc3b451e59f533910b11fe69452f6d2720a2f0d)]:
  - @bdocs/parser@1.0.0

## 2.9.3

### Patch Changes

- [`05d3cad`](https://github.com/bolt-docs/boltdocs/commit/05d3cad0d8ba4fbe3f5f0b18babfc0642b3aa082) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix(seo): inject `config.seo` tags into global HTML template and move `<Head>` to root shell

  The homepage `/` was missing SEO tags from `config.seo` (og:image, custom metatags, etc.) because:
  1. `injectHtmlMeta` only used `config.theme` values and ignored `config.seo` entirely — now it emits og:image, twitter:image, custom metatags, and robots meta from the seo config.
  2. The `<Head>` component (which produces page-specific SEO via react-helmet-async) was only rendered inside `<DocsLayout>`, which only wraps routes under `baseDocsPath` (e.g. `/docs`). Moved `<Head>` up to `BoltdocsShell` so it covers all routes including external pages, collection pages, and the catch-all route.

## 2.9.2

### Patch Changes

- [`8dec178`](https://github.com/bolt-docs/boltdocs/commit/8dec1783eb1c17f60e4cd3a2a69992b1745d2b6b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix React hydration mismatch by initializing resolvedTheme to 'light' on client initial mount, and add a dedicated isolated 'boltdocs/server' entrypoint to completely prevent serverless execution crashes due to heavy build dependencies.

## 2.9.1

### Patch Changes

- [`85cf6ba`](https://github.com/bolt-docs/boltdocs/commit/85cf6baf7dcfd2bee3952d44f250d309bb955fea) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Refactor main Node entrypoint imports to use dynamic imports for heavy build-time dependencies, preventing runtime crashes in Vercel serverless functions.

## 2.9.0

### Minor Changes

- [`b819f24`](https://github.com/bolt-docs/boltdocs/commit/b819f240fa420d873db0e0f3ff0443e6ff1a3e7b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **boltdocs (Minor)**:
  - Extracted the `@bdocs/dui` toolkit as a standalone terminal UI package.
  - Added native feedback integrations supporting Vercel, Netlify, and AWS Lambda adapters.
  - Supported the new `transformSource` plugin lifecycle hook for custom Remark/Rehype preprocessing.
  - Added new CLI dev server flags: `--port`, `--host`, and `--force`.
  - Implemented Phase 0 performance optimizations: deduplicated dev config resolution, instant dev server prewarming, pre-loaded Shiki highlighter during plugin configuration, and added debounced `TransformCache` index persistence.
  - Fixed collection routes provider wrapping at the global shell level, corrected `cover` frontmatter fallbacks, and updated outdated collections hook documentation examples.
  - **create-boltdocs (Minor)**:
    - Completed a full rewrite of the scaffolding CLI templates using the `@bdocs/dui` terminal package.
    - Added integration setup helpers and automated deployment adapters.
  - **@bdocs/plugin-image-optimizer (Minor)**:
    - Added the `@bdocs/plugin-image-optimizer` package to automatically optimize and cache WebP/SVG/PNG assets during static build compilation.
  - **@bdocs/plugin-mermaid (Patch)**:
    - Performance optimizations to prevent Mermaid scripts from blocking client rendering.

### Patch Changes

- Updated dependencies [[`b819f24`](https://github.com/bolt-docs/boltdocs/commit/b819f240fa420d873db0e0f3ff0443e6ff1a3e7b)]:
  - @bdocs/plugin-image-optimizer@0.2.0

## 2.8.4

### Patch Changes

- [`5fb0685`](https://github.com/bolt-docs/boltdocs/commit/5fb06852bfbd94e84cd502f5e874acd1e5f6d947) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: solve various bugs including theme flashing, i18n sidebar disappearing/duplication, upgrade check reliability, CLI port/host support, and create-boltdocs project name argument support.

  Specifically for i18n, sidebar, and fallback route routing:
  - Refactored `useSidebar` to perform hierarchical tree calculations cleanly without mutations.
  - Filtered out fallback redirect routes in `useSidebar` via the `fallback` route property to eliminate duplicate entries in the sidebar.
  - Preserved `filePath` properties on index/container route nodes so that client-side language switching and active link highlighting operate correctly.

## 2.8.3

### Patch Changes

- [`af3a19c`](https://github.com/bolt-docs/boltdocs/commit/af3a19c8836b0712ac186ba99d4987d828945612) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Revert base path configuration override in Vite plugin to restore correct asset routing and fix 404 errors in production.

## 2.8.2

### Patch Changes

- [`d55094d`](https://github.com/bolt-docs/boltdocs/commit/d55094db2b7afe4d7e00e2477d08483647ec1d8d) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix SSR rendering error with i18n configurations by safely guarding route path accesses on index/fallback routes. Correctly write performance metrics to build output directory.

- Updated dependencies [[`d55094d`](https://github.com/bolt-docs/boltdocs/commit/d55094db2b7afe4d7e00e2477d08483647ec1d8d)]:
  - @bdocs/ssg@0.1.1

## 2.8.1

### Patch Changes

- [`bbba61c`](https://github.com/bolt-docs/boltdocs/commit/bbba61c7351e56d138bd5957f236f0036e3bbe28) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared style of block-code

## 2.8.0

### Minor Changes

- [`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Route-level code splitting**: MDX pages are now lazy-loaded on demand client-side using dynamic imports, with background prefetching in idle time and parallelized compilation pre-warming.
  - **Diagnostic performance budgets**: Added checks for bundle and page HTML sizes, image/font counts, and build times under a new `checks.performance` configuration in `doctor.json`, run via `boltdocs doctor --budget`.
  - **Plugin system simplification & safety**: Removed complex dynamic sandboxes and the `permissions` configuration. Added chain-pattern MDX/HTML transformation hooks (`transformMdx` and `transformHtml`), simplified available lifecycle hooks, and automated file-system access containment warnings.
  - **Strict route path typing**: Introduced compiler-generated route path maps to support type-safe autocomplete for navigation navbar/sidebar definitions and custom Link components.
  - **Directory caches reorganised**: Re-structured `.boltdocs/` internal metadata caches into specific `build/`, `cache/`, `generated/`, and `reports/` subdirectories.
  - **Codeblock destructuring & plugin utils**: Refactored traversal helper functions to run across generic AST formats. Fixed React DOM warnings on code block node attributes.
  - **Bug Fix**: Fixed a config loader exception by correctly exporting `MDX_NODES` from the core entry point.
  - **Miscellaneous improvements**: Configured `react-router-dom` in server-side bundling to prevent SSR load exceptions, added horizontal overflow scrolling for tabs, and improved mobile layout padding.

### Patch Changes

- Updated dependencies [[`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32), [`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32)]:
  - @bdocs/dui@0.1.2
  - @bdocs/ssg@0.1.0

## 2.7.11

### Patch Changes

- [`1182df9`](https://github.com/bolt-docs/boltdocs/commit/1182df9a1964409da9e0e4b7b1977f9ec887e4aa) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Exclude src/client from published files, point Tailwind @source to dist, disable minify for client build

## 2.7.10

### Patch Changes

- [`a780571`](https://github.com/bolt-docs/boltdocs/commit/a78057165a087b36793ceced3bf5799631b9261a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat(dui): add `configure()`/`getConfig()` for runtime identity — log prefix, server box titles, and update command are now configurable at the CLI entry point instead of hardcoded. fix(dui): default `updateCommand` corrected from `@bdocs/dui` to `boltdocs`. fix(dui): `stripAnsi()` now handles OSC hyperlinks and CSI cursor sequences, not just SGR colors. refactor(dui): `devServer()`/`previewServer()` consolidated via shared `buildServerBox()` helper. chore(dui): `padLeft` renamed to `padRight` for clarity. chore(dui): comprehensive tests added for logger, config, confirm, and formatLog. fix(ssg): missing kolorist-to-dui migration in `build.ts` (`dim`, `cyan`, `green`, `gray`, `red` bare calls) resolved — fixes runtime `ReferenceError: gray is not defined`. fix(core): `dev-server.ts` `console.error('[boltdocs]')` → `dui.error()`; `cli-entry.ts` adds `configure()` call.

- [`375264f`](https://github.com/bolt-docs/boltdocs/commit/375264fb24912fa51da39ccb9fbc78b3a4962b72) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Remove `ansiCodes` raw ANSI export from `@bdocs/dui`. Core CLI `ui.ts` now re-exports `dui.colors` (picocolors) directly — no more ANSI escape code usage anywhere. `formatLog` and `confirm` use picocolors functions.

- [`b736267`](https://github.com/bolt-docs/boltdocs/commit/b736267f8764ab92f9b4fb3ee1f9f0b0bd07e6e0) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix picocolors usage across `@bdocs/dui` (use function calls instead of template literal interpolation). Add `ansiCodes` export for backward-compatible raw ANSI sequences. Migrate doctor output to use `@bdocs/dui` — replace raw ANSI with picocolors functions and use `dui.box.double()` for diagnosis summary.

- [`f478f53`](https://github.com/bolt-docs/boltdocs/commit/f478f539a6da7a32c9ecef44fda0013b7b478133) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Complete migration from `ui.ts` wrapper to direct `@bdocs/dui` imports across core. Move `confirm`/`formatLog` into dui. Remove `ui.ts` entirely. Phase 3: migrate changelog generator output to dui logger/box.

- [`f0be317`](https://github.com/bolt-docs/boltdocs/commit/f0be317824d34e6827284a342af946de53396c18) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Create `@bdocs/dui` terminal UI package with boxes, logger, lists, and dividers. Wire into core CLI (`ui.ts`) and update-check (`update-check.ts`).

- Updated dependencies [[`a780571`](https://github.com/bolt-docs/boltdocs/commit/a78057165a087b36793ceced3bf5799631b9261a), [`375264f`](https://github.com/bolt-docs/boltdocs/commit/375264fb24912fa51da39ccb9fbc78b3a4962b72), [`b736267`](https://github.com/bolt-docs/boltdocs/commit/b736267f8764ab92f9b4fb3ee1f9f0b0bd07e6e0), [`f478f53`](https://github.com/bolt-docs/boltdocs/commit/f478f539a6da7a32c9ecef44fda0013b7b478133), [`36a7d09`](https://github.com/bolt-docs/boltdocs/commit/36a7d093a0304620ddaed6c2ed8616edbaa62987), [`f0be317`](https://github.com/bolt-docs/boltdocs/commit/f0be317824d34e6827284a342af946de53396c18)]:
  - @bdocs/dui@0.1.1
  - @bdocs/ssg@0.0.7

## 2.7.9

### Patch Changes

- [`d600cdf`](https://github.com/bolt-docs/boltdocs/commit/d600cdf1086009762409323802c9b7302bb327df) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix false positive "broken internal link" reports for URLs inside fenced code blocks and inline code in the `boltdocs doctor` command. The link checker now strips code block content before scanning for links, preventing demo/example code from being treated as actual broken links.

- [`ac10e5b`](https://github.com/bolt-docs/boltdocs/commit/ac10e5be26a93a5ca2403f72a670b806461cbc20) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix duplicate sidebar links caused by fallback metadata entries copying `filePath` and `slugParts` from the original route. The fallback entry now sets `filePath: ''` and `slugParts: []` so the sidebar code skips it.

- [`ae0d6ad`](https://github.com/bolt-docs/boltdocs/commit/ae0d6ad51ba81b83f6d9ef45e310133c7072d883) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Rewrite README with benchmark comparisons, tech stack showcase, detailed features with code examples, ecosystem table, roadmap, and improved structure. Add README to `packages/core/` for npm package display.

- [`9e7094d`](https://github.com/bolt-docs/boltdocs/commit/9e7094d2e5ebc2e0b7f14cce0fb61ee9f69b5db3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Show update notification when a new version of boltdocs is available. The `dev`, `build`, and `doctor` commands now check the npm registry and display a colored box with the current and latest version when an upgrade is available.

- Updated dependencies [[`ee67a51`](https://github.com/bolt-docs/boltdocs/commit/ee67a5141282d4cbc9db0cf839c2073364f3f44a)]:
  - @bdocs/ssg@0.0.6

## 2.7.8

### Patch Changes

- [`09b3cbf`](https://github.com/bolt-docs/boltdocs/commit/09b3cbf21553cdcf24afbfd03fb6c9f8391a0b6a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix React 19 hydration mismatches and route duplication/double-rendering on subpage refreshes by configuring the router's basename, prepending the basename prefix during SSR query rendering, and extracting/inlining static router hydration data into the head.

- [`cbb1914`](https://github.com/bolt-docs/boltdocs/commit/cbb1914745217fe66e0c5854c2d592b521a1b26b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Switch to flat HTML output (`about.html` instead of `about/index.html`), generate own `__staticRouterHydrationData` script, sanitize hydration data, and fix fallback route index handling for docs base path. This resolves hydration mismatches and page duplication on subpage refresh across all deployment platforms.

- Updated dependencies [[`f0c9703`](https://github.com/bolt-docs/boltdocs/commit/f0c9703e9b568c03ddfe5061bb0faa1942c84b4f), [`09b3cbf`](https://github.com/bolt-docs/boltdocs/commit/09b3cbf21553cdcf24afbfd03fb6c9f8391a0b6a), [`cbb1914`](https://github.com/bolt-docs/boltdocs/commit/cbb1914745217fe66e0c5854c2d592b521a1b26b)]:
  - @bdocs/ssg@0.0.5

## 2.7.7

### Patch Changes

- [`b5e54f1`](https://github.com/bolt-docs/boltdocs/commit/b5e54f16e9b792f4c3616ad7a3ee368f4a1a8fda) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix empty page on docs base path redirects, breadcrumbs, TOC, and active sidebar link highlight.
  Fix hydration crash and caching bug for static loader data in production by adding cache-busting query parameters and safe JSON fetch handling.
- Updated dependencies [[`b5e54f1`](https://github.com/bolt-docs/boltdocs/commit/b5e54f16e9b792f4c3616ad7a3ee368f4a1a8fda)]:
  - @bdocs/ssg@0.0.4

## 2.7.6

### Patch Changes

- [`e5e5ebb`](https://github.com/bolt-docs/boltdocs/commit/e5e5ebbf370acdeb9eaab77a296f37493f7b5d0f) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve SSG route resolution causing home page content to leak into all routes

- Updated dependencies [[`e5e5ebb`](https://github.com/bolt-docs/boltdocs/commit/e5e5ebbf370acdeb9eaab77a296f37493f7b5d0f)]:
  - @bdocs/ssg@0.0.3

## 2.7.5

### Patch Changes

- [`b9af040`](https://github.com/bolt-docs/boltdocs/commit/b9af040f70158409ae563b2b6776efa6d3607707) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - perf: refine incremental build caching and fix loader hash stability
  fix: ensure docs layout wrapper is constrained to the base docs path to prevent hijacking external routes (like homepage/about) during client-side hydration.

## 2.7.4

### Patch Changes

- [`2ca7562`](https://github.com/bolt-docs/boltdocs/commit/2ca7562b7f6b95955426afdbf15b94b82b5d3e60) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve config syntax and ssr optimizeDeps interop

## 2.7.3

### Patch Changes

- [`ca0f95a`](https://github.com/bolt-docs/boltdocs/commit/ca0f95a1e34289c5f591497d513786fd2917ff4a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve CJS/ESM interop issues for react-fast-compare and react-router-dom - Add react-fast-compare to optimizeDeps.include (browser) and ssr.optimizeDeps.include (SSR) to fix missing default export - Add react-router-dom to ssr.noExternal to fix 'module is not defined' in Vite 8 SSR module runner - Apply same fixes to plugin config hook for consumer-side usage

## 2.7.2

### Patch Changes

- [`31cdab2`](https://github.com/bolt-docs/boltdocs/commit/31cdab269e64b59a12cc55349352b393fe5f6f75) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - perf(core): Improved performance in warm

- Updated dependencies [[`31cdab2`](https://github.com/bolt-docs/boltdocs/commit/31cdab269e64b59a12cc55349352b393fe5f6f75)]:
  - @bdocs/ssg@0.0.2

## 2.7.1

### Patch Changes

- [`044ce18`](https://github.com/bolt-docs/boltdocs/commit/044ce18cf54812e486f0af0befdf952e26ebb2f9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error of ssg

## 2.7.0

### Minor Changes

- [`b04fce4`](https://github.com/bolt-docs/boltdocs/commit/b04fce42678230b607adcde349e8bb95f6dca1f3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **feat**: Added support for `lastUpdated` property in documentation pages.
  - **feat**: Significant performance improvements in documentation parsing through a new caching parser.
  - **feat**: Doctor is now stable.
  - **feat**: Added banner on site home page.
  - **feat**: Added Google Analytics 4 support & Google Tag Manager support.
  - **feat**: Added Changelog Generator. he UI to have a better look.
  - **feat**: Updated File-Routing to support new features. - Support Deeper Nested routes - Support metadata file naming (meta.json & \_meta.json) - Support collapsible/collapsed directories - Support custom directory icons
  - **feat**: Added `base` support for base-url routing.
  - **feat**: Added custom-frontmatter & extended MDX frontmatter support.
  - **feat**: Search highlight now works with accents & Mark search works on dynamic content.
  - **fix**: Improved mobile support and responsive layout consistency across the site.
  - **fix**: Resolved styling issues and improved integration for Mermaid diagrams.
  - **fix**: Corrected locale labels in example projects.
  - **fix**: Optimized Tabs and Navbar components to reduce unnecessary re-renders.
  - **fix**: Removed config prop from CopyMarkdown component.
  - **fix**: Removed the need to define `homePage` in `boltdocs.config.ts` when using `pages-external/index.tsx` for a custom home page.
  - **fix**: Added export code-block support for Custom Components.

## 2.6.2

### Patch Changes

- [`2960c55`](https://github.com/bolt-docs/boltdocs/commit/2960c5523040723f2389568b5e72866875617789) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared bug collision pages & navigation
  fix: repared bug 404 when switch version in home
  feat: support types-generator for better autocomplete

## 2.6.1

### Patch Changes

- [`bdc7634`](https://github.com/bolt-docs/boltdocs/commit/bdc7634239ba5e220a4b1fe2792aaa66e6944e46) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: error in developer in build

## 2.6.0

### Minor Changes

- [`6a6d829`](https://github.com/bolt-docs/boltdocs/commit/6a6d82941328c1f2c016781d8d0f004d3a890237) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: new engine ssg
  feat: line-number & word-wrap in code-block
  feat: support languagues rust & toml
  fix: removed ogImage
  feat: support seo granular configuration in frontmatter & config
  fix: removed shadow image
  fix: support detect xml in sitemap
  fix: removed hover in field
  style: updated Admonition styles
  fix: removed style uppercase in sidebar & onthispage
  fix: repared warning each child of react key
  feat: support icons external

## 2.5.6

### Patch Changes

- [`5236e13`](https://github.com/bolt-docs/boltdocs/commit/5236e1379f94699bbbb176826b6eabb4dbb8faa7) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error in mode developer

## 2.5.5

### Patch Changes

- [`c31cfe3`](https://github.com/bolt-docs/boltdocs/commit/c31cfe3777e77b4ef0290aa726696b493f9c51db) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - repared error use-external

## 2.5.4

### Patch Changes

- [`7477d85`](https://github.com/bolt-docs/boltdocs/commit/7477d85ee486af85cdae0ca26aba67ae9071cce9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: added use-async-external-store with in optimizeDeps

## 2.5.3

### Patch Changes

- [`613b4b7`](https://github.com/bolt-docs/boltdocs/commit/613b4b7c256b2dec3af6d2aa7eb00f1b9a9beea1) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - removed integrations of config

## 2.5.2

### Patch Changes

- [`862634f`](https://github.com/bolt-docs/boltdocs/commit/862634fb0df4e10112877e05e31b12ce7a4f480e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - removed sandbox integrations

## 2.5.1

### Patch Changes

- [`6f47dae`](https://github.com/bolt-docs/boltdocs/commit/6f47dae6a572e1d2ec8c28e56c648ab2db7b96d5) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - repared error show visible CodeBlock & repared error components Plugins

## 2.5.0

### Minor Changes

- [`de41957`](https://github.com/bolt-docs/boltdocs/commit/de4195754bbb6dea90cbcd91e1ae3ddc398a8fdb) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Updated imports to simples, support CPS, Support External-Page with file

### Patch Changes

- [`f54fc62`](https://github.com/bolt-docs/boltdocs/commit/f54fc62982411e893beeccb2ebcb20d7a4925bdd) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - export types of plugins, Config & theme

## 2.4.2

### Patch Changes

- [`3073b74`](https://github.com/bolt-docs/boltdocs/commit/3073b747b9bd90e154c24758b5a502dfe51c043e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error in build with virtual-imports

## 2.4.1

### Patch Changes

- [`80de4bd`](https://github.com/bolt-docs/boltdocs/commit/80de4bd49c3de90ec234148c8077b479935db2cf) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - updated width with pathname

- [`c49cefa`](https://github.com/bolt-docs/boltdocs/commit/c49cefa292075606ae626826a890a93bda939ba5) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - added name tabs in URLs & repared icons size

## 2.4.0

### Minor Changes

- [`0ee1f85`](https://github.com/bolt-docs/boltdocs/commit/0ee1f8525500ca6b6dc1eb78260fc257b3698fd4) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Support icons & title CodeBlock, Better Scroll, export Skeleton Component

## 2.3.0

### Minor Changes

- [`5d53fd0`](https://github.com/jesusalcaladev/boltdocs/commit/5d53fd0eddbcc0e22b092f52cea82df78063376b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: added new primitives `Skeleton`
  feat: added new loading with `Skeleton` primitives
  feat: added new command `boltdocs doctor` for diagnostic your project
  feat: support full-text search
  fix: better calc in page-nav

## 2.2.0

### Minor Changes

- [`766daf2`](https://github.com/jesusalcaladev/boltdocs/commit/766daf21becafaa173a65cc8bea4d31b32ce8640) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: support i18n in links & tabs
  feat: change component Loading
  feat: dectecttheme of system
  perf: better calc in the routes & navigation

## 2.1.1

### Patch Changes

- [`1ce39bb`](https://github.com/jesusalcaladev/boltdocs/commit/1ce39bbe07974f35f6a04c341c5578c337f37024) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error of deploy

## 2.1.0

### Minor Changes

- [`06650d4`](https://github.com/jesusalcaladev/boltdocs/commit/06650d458c26c7bbf4cc2da7ea6bec6352c0c530) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: extract vite.config.ts for used boltdocs.config.ts, support favicon, robots, ogImage

## 2.0.0

### Major Changes

- [`105352e`](https://github.com/jesusalcaladev/boltdocs/commit/105352efc13f081c5fdb6bbcad11891be78f87a7) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: secutity in build & production, repare error in build with virtual:boltdocs-layout
