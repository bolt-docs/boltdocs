---
'boltdocs': patch
'@bdocs/processor-satteri': patch
'@bdocs/unist-utils': patch
---

Make code syntax highlighting engine-agnostic: the core now renders via a `CodeHighlighterAdapter` resolved from a registry instead of calling Shiki directly.

- **`theme.codeHighlighting`**: new configuration surface (`engine`, `theme`, `options`) that replaces `theme.codeTheme`. Shiki remains the built-in default engine (`engine: 'shiki'`); any adapter instance or factory can be injected inline. A **string shorthand** is accepted — `codeHighlighting: 'shiki'` is equivalent to `{ engine: 'shiki' }`. `theme.codeTheme` still works as a deprecated alias resolving to `codeHighlighting.theme`. Single-string themes render single-theme output (no dual-mode CSS variables), and objects keep the dual light/dark `data-theme-mode="dual"` rendering.
- **Highlighter registry** (`boltdocs/node/highlight`): `getCodeHighlighterAdapter()`, `registerHighlighter()` / `registerPluginHighlighter()`, and `prewarmHighlighter()`. Engines that are never selected cost nothing at runtime; the current engine is prewarmed during build and after the dev server starts. A broken or unresolvable engine falls back to Shiki with a warning instead of failing the build.
- **Plugin field `codeHighlighter`**: plugins expose their engine under `plugin.name`, so `theme.codeHighlighting.engine` can select it by id.
- **`options.regexEngine: 'oniguruma' | 'javascript'`** for the Shiki engine: the **JavaScript regex engine is now the default**, cutting highlighter startup from ~2.5s to ~200ms per compile-pool worker. Unsupported grammar regexes degrade approximately (`forgiving` mode) instead of failing. Pass `regexEngine: 'oniguruma'` for bit-exact TextMate fidelity on exotic grammars.
- **Single grammar pass per code block**: the Sätteri rehype plugin serializes the highlighted HAST (`hast-util-to-html`) instead of re-running the grammar through `codeToHtml`, roughly halving highlighting CPU per block. `data-highlighted-html` output is byte-equivalent.
- **Per-worker highlight cache**: identical `(lang, options, code)` blocks highlight once per long-lived compile-pool worker (LRU, 2000 entries) — repeated install commands and shared snippets across hundreds of pages are free.
- **Grammar prewarm at pool start**: compile workers now prewarm with fenced blocks in every eager language, so grammar loading overlaps pool spin-up instead of running serially on the first pages.
- The Sätteri rehype plugin is renamed to `satteriRehypeCodeHighlightPlugin` (`satteriRehypeShikiPlugin` kept as an alias) and emits engine-neutral `data-code-engine` / `data-theme-mode` attributes while keeping the `.shiki-*` classes for backwards compatibility.
