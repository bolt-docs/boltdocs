---
'boltdocs': minor
'@bdocs/processor-satteri': minor
---

Make code syntax highlighting engine-agnostic: the core now renders via a `CodeHighlighterAdapter` resolved from a registry instead of calling Shiki directly.

- **`theme.codeHighlighting`**: new configuration surface (`engine`, `theme`, `options`) that replaces `theme.codeTheme`. Shiki remains the built-in default engine (`engine: 'shiki'`); any adapter instance or factory can be injected inline. `theme.codeTheme` still works as a deprecated alias resolving to `codeHighlighting.theme`. Single-string themes render single-theme output (no dual-mode CSS variables), and objects keep the dual light/dark `data-theme-mode="dual"` rendering.
- **Highlighter registry** (`boltdocs/node/highlight`): `getCodeHighlighterAdapter()`, `registerHighlighter()` / `registerPluginHighlighter()`, and `prewarmHighlighter()`. Engines that are never selected cost nothing at runtime; the current engine is prewarmed during build and after the dev server starts. A broken or unresolvable engine falls back to Shiki with a warning instead of failing the build.
- **Plugin field `codeHighlighter`**: plugins expose their engine under `plugin.name`, so `theme.codeHighlighting.engine` can select it by id.
- **`options.regexEngine: 'oniguruma' | 'javascript'`** for the Shiki engine: `'javascript'` swaps Oniguruma WASM for Shiki's native JS regex engine, cutting highlighter startup from ~2.5s to ~200ms at a small fidelity cost for exotic grammars.
- The Sätteri rehype plugin is renamed to `satteriRehypeCodeHighlightPlugin` (`satteriRehypeShikiPlugin` kept as an alias) and emits engine-neutral `data-code-engine` / `data-theme-mode` attributes while keeping the `.shiki-*` classes for backwards compatibility.
