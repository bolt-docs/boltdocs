---
"boltdocs": patch
---

Ship 11.7 MB fewer installed packages by depending on the Shiki packages actually used.

The core imported `shiki/core` and a few Shiki types, but declared the full `shiki` package, which carries `@shikijs/langs` (9.9 MB) and `@shikijs/themes` (1.8 MB) as ordinary dependencies. Of the 347 language grammars in `@shikijs/langs`, the highlighter could reach 39 — any other fence fell back to plain text — so roughly 8 MB of grammars was unreachable on every install.

The reachable grammars are now vendored inside the package and `shiki` is replaced by `@shikijs/core` plus the two engine packages, imported at their real paths. Highlighting output is unchanged: a documentation build of 259 pages containing 956 code blocks across 17 languages produces byte-identical HTML.
