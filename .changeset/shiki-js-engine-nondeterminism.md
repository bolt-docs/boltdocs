---
"boltdocs": patch
---

Shiki's JavaScript regex engine produces different highlighting for identical input between runs, so code blocks can differ between builds.

Measured on unmodified 3.4/4.0 code, no Boltdocs code involved — upstream `@shikijs/core@3.23.0` with `@shikijs/engine-javascript` and the grammars from `@shikijs/langs`:

```js
const start = Date.now()
```

produced four distinct tokenizations across eight runs, among them merging `= Date.now()` into one span or splitting `now` out as a function call. Switching the same input to `@shikijs/engine-oniguruma` gave the same output six times out of six, and the most accurate of the variants.

Nothing in this release changes the default engine. The JavaScript engine stays the default because it avoids a ~2.5s synchronous highlighter startup, but its output is not reproducible and this was measured rather than inferred. Sites that need byte-stable code blocks should set `theme.codeHighlighting.options.regexEngine` to `'oniguruma'`, which pays for the larger engine and the slower startup.
