---
"boltdocs": patch
---

The highlighter's default engine is Oniguruma, and the JavaScript engine is gone from the default path.

Shiki's JavaScript regex engine produces different highlighting for identical input between runs, so code blocks can differ between builds.

Measured on unmodified 3.4/4.0 code, no Boltdocs code involved — upstream `@shikijs/core@3.23.0` with `@shikijs/engine-javascript` and the grammars from `@shikijs/langs`:

```js
const start = Date.now()
```

produced four distinct tokenizations across eight runs, among them merging `= Date.now()` into one span or splitting `now` out as a function call. Switching the same input to `@shikijs/engine-oniguruma` gave the same output six times out of six, and the most accurate of the variants.

Oniguruma is also the faster engine for the work a build actually does. Highlighting is 96% of an MDX compile — on the documentation site's 971 code blocks it is 8.5 s of a 12.9 s compile — and the engine was chosen on the strength of a startup cost that no longer held: the code claimed it cut the engine build from ~2.5 s to ~200 ms, and measured today it is 548 ms against 357 ms. The startup was the wrong cost to weigh.

| | Oniguruma | JavaScript |
| --- | --- | --- |
| Engine startup | 548 ms | 357 ms |
| One code block | 2.8 ms | 9.9 ms |
| 654 unique blocks | 1.8 s | 6.4 s |

A build pays the startup once and the blocks once per language, so the blocks decide. The documentation site's precompile went from 8.6 s to 6.6 s, and the build from 24.2 s to 21.6 s — measured across three interleaved A/B builds.

Set `theme.codeHighlighting.options.regexEngine` to `'javascript'` to trade that reproducibility and accuracy for the smaller startup — the right choice for a site with few code blocks.
