---
'boltdocs': patch
'@bdocs/processor-satteri': patch
---

Fix a dev-server race where a `server.restart()` could dispose the shared route-cache context while the new server's virtual modules still held a reference to it, surfacing as "Route cache context has been disposed" errors on reload. The route cache context is now re-created defensively when a disposed context is detected during route regeneration.

Fix code highlighting when a single `codeTheme` string (e.g. `codeTheme: 'github-dark'`) is configured: the Sätteri rehype-shiki plugin now receives the resolved `codeTheme` and passes it to the Shiki adapter, instead of silently falling back to the default light/dark dual theme (which produced dual-theme CSS variables that broke single-theme color rendering).

Fix stale compiled-MDX output after processor changes: the compiled-pages cache key now includes the `@bdocs/processor-satteri` package version and the manifest version is bumped, so any published change to the compiler pipeline (e.g. Shiki highlighting) invalidates previously cached pages instead of serving pre-fix output.

Fix code-block syntax highlighting disappearing in dark mode: the theme's Shiki light/dark color rules were applied to every `.shiki` block via `color: var(--shiki-dark) !important`, which wiped single-theme inline token colors (e.g. `codeTheme: 'github-dark'`) because `--shiki-dark` is undefined on that output. Those rules are now scoped to dual-theme output (`.shiki.shiki-themes`) and cover both light and dark modes, leaving single-theme inline colors intact.

Fix code blocks in languages outside the bundled grammar list (e.g. `nginx`, `apache`) silently rendering as unformatted plain text: the Sätteri rehype-shiki plugin now retries unknown languages as `plaintext` so the block keeps its Shiki styling instead of falling back to an unstyled pre, and the bundled language list is expanded with common documentation-site languages (`nginx`, `apache`, `dockerfile`, `docker`, `json5`, `scss`, `less`, `python`, `go`, `java`, `php`, `sql`, `graphql`, `http`, `xml`, `vue`, `svelte`, `ruby`, `kotlin`, `swift`, `powershell`, `c`, `cpp`, `elixir`).
