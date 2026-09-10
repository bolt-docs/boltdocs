# @bdocs/processor-satteri

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
