# @bdocs/processor-satteri

## 0.4.0

### Minor Changes

- [`67e9a00`](https://github.com/bolt-docs/boltdocs/commit/67e9a00b410720bf21f5516c214c991d544b6e1e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Make code syntax highlighting engine-agnostic: the core now renders via a `CodeHighlighterAdapter` resolved from a registry instead of calling Shiki directly.
  - **`theme.codeHighlighting`**: new configuration surface (`engine`, `theme`, `options`) that replaces `theme.codeTheme`. Shiki remains the built-in default engine (`engine: 'shiki'`); any adapter instance or factory can be injected inline. A **string shorthand** is accepted — `codeHighlighting: 'shiki'` is equivalent to `{ engine: 'shiki' }`. `theme.codeTheme` still works as a deprecated alias resolving to `codeHighlighting.theme`. Single-string themes render single-theme output (no dual-mode CSS variables), and objects keep the dual light/dark `data-theme-mode="dual"` rendering.
  - **Highlighter registry** (`boltdocs/node/highlight`): `getCodeHighlighterAdapter()`, `registerHighlighter()` / `registerPluginHighlighter()`, and `prewarmHighlighter()`. Engines that are never selected cost nothing at runtime; the current engine is prewarmed during build and after the dev server starts. A broken or unresolvable engine falls back to Shiki with a warning instead of failing the build.
  - **Plugin field `codeHighlighter`**: plugins expose their engine under `plugin.name`, so `theme.codeHighlighting.engine` can select it by id.
  - **`options.regexEngine: 'oniguruma' | 'javascript'`** for the Shiki engine: the **JavaScript regex engine is now the default**, cutting highlighter startup from ~2.5s to ~200ms per compile-pool worker. Unsupported grammar regexes degrade approximately (`forgiving` mode) instead of failing. Pass `regexEngine: 'oniguruma'` for bit-exact TextMate fidelity on exotic grammars.
  - **Single grammar pass per code block**: the Sätteri rehype plugin serializes the highlighted HAST (`hast-util-to-html`) instead of re-running the grammar through `codeToHtml`, roughly halving highlighting CPU per block. `data-highlighted-html` output is byte-equivalent.
  - **Per-worker highlight cache**: identical `(lang, options, code)` blocks highlight once per long-lived compile-pool worker (LRU, 2000 entries) — repeated install commands and shared snippets across hundreds of pages are free.
  - **Grammar prewarm at pool start**: compile workers now prewarm with fenced blocks in every eager language, so grammar loading overlaps pool spin-up instead of running serially on the first pages.
  - The Sätteri rehype plugin is renamed to `satteriRehypeCodeHighlightPlugin` (`satteriRehypeShikiPlugin` kept as an alias) and emits engine-neutral `data-code-engine` / `data-theme-mode` attributes while keeping the `.shiki-*` classes for backwards compatibility.

### Patch Changes

- [`eed5613`](https://github.com/bolt-docs/boltdocs/commit/eed56139c20fac1b13a575acffdb1104480c6be2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix two silent bugs that disabled the MDX precompile cache on every build
  - **Absolute `docsDir` corrupted the precompile scan path** — core passes a resolved absolute `docsDir`, but the plugin joined it onto the Vite root (`path.join(root, docsDir)`), producing a nonexistent path. `fs.existsSync` failed silently and the whole precompile pass (and its worker pool) was skipped on every build. Now uses `path.resolve`, which handles both relative and absolute paths.
  - **Per-process nonce invalidated the manifest `globalKey`** — non-persistent user plugins were signed with a `pid:Date.now():Math.random()` nonce baked into the compiler signature, so the manifest key differed on every process and the on-disk compiled-MDX cache could never produce a hit: all pages were recompiled on every build. The nonce is replaced by the stable `__boltdocsCacheSignature` (name@version:options) identity marker.

  Measured on the 259-page docs site: warm builds now report `precompile: 231 hit / 0 miss / 1.5s` instead of recompiling the full site invisibly on every build.

- Updated dependencies [[`67e9a00`](https://github.com/bolt-docs/boltdocs/commit/67e9a00b410720bf21f5516c214c991d544b6e1e)]:
  - @bdocs/unist-utils@0.3.0

## 0.3.1

### Patch Changes

- [`fbd8502`](https://github.com/bolt-docs/boltdocs/commit/fbd850235fba791b65945fe14ff519cff9dedd25) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix two silent bugs that disabled the MDX precompile cache on every build
  - **Absolute `docsDir` corrupted the precompile scan path** — core passes a resolved absolute `docsDir`, but the plugin joined it onto the Vite root (`path.join(root, docsDir)`), producing a nonexistent path. `fs.existsSync` failed silently and the whole precompile pass (and its worker pool) was skipped on every build. Now uses `path.resolve`, which handles both relative and absolute paths.
  - **Per-process nonce invalidated the manifest `globalKey`** — non-persistent user plugins were signed with a `pid:Date.now():Math.random()` nonce baked into the compiler signature, so the manifest key differed on every process and the on-disk compiled-MDX cache could never produce a hit: all pages were recompiled on every build. The nonce is replaced by the stable `__boltdocsCacheSignature` (name@version:options) identity marker.

  Measured on the 259-page docs site: warm builds now report `precompile: 231 hit / 0 miss / 1.5s` instead of recompiling the full site invisibly on every build.

## 0.3.0

### Minor Changes

- [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Precompile MDX early from `configResolved()`, size the worker pool dynamically based on CPU count and file count, and fix remaining JSX transpilation in compiler workers with stale cache invalidation.

### Patch Changes

- [`97af04d`](https://github.com/bolt-docs/boltdocs/commit/97af04da95657e1e72ecee548b1c1cc55c3d5f81) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Declare `esbuild` as a runtime dependency so published processor builds can resolve it in pnpm-isolated consumer projects.

- [`a33d512`](https://github.com/bolt-docs/boltdocs/commit/a33d512b965bcc701ed76e98db632dcf45fd8bd9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix a dev-server race where a `server.restart()` could dispose the shared route-cache context while the new server's virtual modules still held a reference to it, surfacing as "Route cache context has been disposed" errors on reload. The route cache context is now re-created defensively when a disposed context is detected during route regeneration.

  Fix code highlighting when a single `codeTheme` string (e.g. `codeTheme: 'github-dark'`) is configured: the Sätteri rehype-shiki plugin now receives the resolved `codeTheme` and passes it to the Shiki adapter, instead of silently falling back to the default light/dark dual theme (which produced dual-theme CSS variables that broke single-theme color rendering).

  Fix stale compiled-MDX output after processor changes: the compiled-pages cache key now includes the `@bdocs/processor-satteri` package version and the manifest version is bumped, so any published change to the compiler pipeline (e.g. Shiki highlighting) invalidates previously cached pages instead of serving pre-fix output.

  Fix code-block syntax highlighting disappearing in dark mode: the theme's Shiki light/dark color rules were applied to every `.shiki` block via `color: var(--shiki-dark) !important`, which wiped single-theme inline token colors (e.g. `codeTheme: 'github-dark'`) because `--shiki-dark` is undefined on that output. Those rules are now scoped to dual-theme output (`.shiki.shiki-themes`) and cover both light and dark modes, leaving single-theme inline colors intact.

  Fix code blocks in languages outside the bundled grammar list (e.g. `nginx`, `apache`) silently rendering as unformatted plain text: the Sätteri rehype-shiki plugin now retries unknown languages as `plaintext` so the block keeps its Shiki styling instead of falling back to an unstyled pre, and the bundled language list is expanded with common documentation-site languages (`nginx`, `apache`, `dockerfile`, `docker`, `json5`, `scss`, `less`, `python`, `go`, `java`, `php`, `sql`, `graphql`, `http`, `xml`, `vue`, `svelte`, `ruby`, `kotlin`, `swift`, `powershell`, `c`, `cpp`, `elixir`).

## 0.2.0

### Minor Changes

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
