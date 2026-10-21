---
'boltdocs': minor
---

The syntax highlighter uses the Oniguruma engine by default.

It used the JavaScript engine, on the strength of its startup cost: the code
claimed it cut the engine build from ~2.5 s to ~200 ms. Measured on this
machine that claim no longer held, and it pointed at the wrong cost.

| | Oniguruma | JavaScript |
| --- | --- | --- |
| Engine startup | 548 ms | 357 ms |
| One code block | 2.8 ms | 9.9 ms |
| 654 unique blocks | 1.8 s | 6.4 s |

A build pays the startup once and the blocks once per language, so the blocks
decide. On the documentation site's 971 code blocks the precompile — 96% of
which is highlighting — went from 8.9 s to 6.4 s, measured across three
interleaved A/B builds.

Oniguruma is also the faithful engine: the JavaScript one degrades unsupported
grammar regexes to approximate matches, while Oniguruma matches TextMate
exactly. The rendered output of the documentation site's code blocks is
byte-identical between the two.

Set `theme.codeHighlighting.options.regexEngine: 'javascript'` to trade that
fidelity for the smaller startup — the right choice for a site with few code
blocks.

This also fixes an inconsistency: `highlight()` chose JavaScript while
`ensureLanguage()` chose Oniguruma, so a caller that loaded a grammar lazily
ended up building a *second* highlighter with the other engine.
