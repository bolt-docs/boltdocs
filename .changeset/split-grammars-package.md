---
'@bdocs/grammars': minor
'boltdocs': major
---

Move the vendored Shiki grammars and themes into `@bdocs/grammars`. The core tarball drops from **2.93 MB to 0.35 MB**.

| | before | after |
| --- | --- | --- |
| `boltdocs` | 2.93 MB (100 files) | **0.35 MB (63 files)** |
| `@bdocs/grammars` | — | 2.62 MB (127 files) |

The grammar data is 2.6 MB and the framework's own JavaScript is 0.3 MB. A site with no C++ blocks never reads `cpp.mjs` — but it downloaded it anyway, because it shipped inside `boltdocs`.

### No user-facing change

`boltdocs` depends on `@bdocs/grammars`, so it installs on its own and every site gets the same 39 languages, the same seven themes and byte-identical highlighted output. Nothing to configure, nothing to import differently, no breaking change for a user.

This is the reason it is a *dependency* rather than an optional one. Making the grammars opt-in would have saved the same bytes but required every site using C++, Rust, PHP, Vue or any of the other 29 languages to know that and install a second package — trading a silent 2.6 MB for a silent broken code block.

### The split is along the existing seam

The engine was already pluggable (`theme.codeHighlighting.engine` resolves through a registry that a plugin can extend). The grammars were not — they were hardcoded in `shiki-langs.ts`. Those are two different axes:

- **engine** — which highlighter implementation. Already free.
- **grammars** — which language tables. Now a package.

Choosing a different engine still changes what consumes these; it does not change this package's role as the registry of languages.

### A build bug this surfaced

`tsdown` emits a chunk for every `import('./grammars/x.mjs')` *and* the copy step placed the original beside it. The first build of the package weighed 5.9 MB instead of 2.9 — two copies of every grammar. `neverBundle` on the grammar and theme directories is what makes the copied files the only ones; there is a comment at that line in `tsdown.config.ts` so the next person does not "simplify" it away.

### Verified

`tests/node/grammar-loading.test.ts` in the core covers the seam: ten languages still register eagerly, a lazy one (`rust`) still resolves through its dynamic import, and `cpp` still loads with its four sibling grammars. The grammar suite moved with the data — including two new assertions that every vendored `.mjs` has a sibling `.d.mts`, and that this package declares no runtime dependency on the framework it serves.
