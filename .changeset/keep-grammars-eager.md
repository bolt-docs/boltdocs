---
'@bdocs/grammars': patch
---

Keep the ten common grammars registered eagerly. This records a measurement, because the change looked obviously right and was wrong.

Moving `COMMON_LANGS` (html, js, ts, tsx, css, bash, json, markdown, python, go) to the lazy path saves 202 ms of synchronous CPU per highlighter construction — 6 ms with an empty set against 208 ms with those ten — which reads as a free win. It is not free, and it is not a win.

Across three cold builds of the 257-page documentation site:

| | median |
| --- | --- |
| ten eager | **31.9 s** |
| all lazy | 50.1 s — **57% slower** |

The saving is real and it moves to a place that costs more than it does. Grammars load once per Sätteri compile worker, and the pool runs several workers at once: parsing ten grammars in parallel at startup is cheap wall-clock time, while the lazy path serializes an import plus a TextMate compile into every worker that touches a code block, all contending for the same cores. Registering eagerly turns N per-worker loads into one per-worker batch, and the batching is the entire effect.

The empty set would be correct for a site with no code blocks and is wrong for a documentation site, which is what this package exists for.

The note lives on `COMMON_LANGS` rather than only here, because the argument that motivated the change — "202 ms is worth saving" — is the one that will be made again. `tests/node/grammar-loading.test.ts` asserts the eager set stays at ten and stays out of the lazy map, so the two lists cannot drift apart, and it keeps the tests that prove every language still loads on demand.
