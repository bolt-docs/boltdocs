# @bdocs/grammars

## 1.1.0

### Minor Changes

- 4fb6ed1: Move the vendored Shiki grammars and themes into `@bdocs/grammars`. The core tarball drops from **2.93 MB to 0.35 MB**.

  |                   | before              | after                  |
  | ----------------- | ------------------- | ---------------------- |
  | `boltdocs`        | 2.93 MB (100 files) | **0.35 MB (63 files)** |
  | `@bdocs/grammars` | —                   | 2.62 MB (127 files)    |

  The grammar data is 2.6 MB and the framework's own JavaScript is 0.3 MB. A site with no C++ blocks never reads `cpp.mjs` — but it downloaded it anyway, because it shipped inside `boltdocs`.

  ### No user-facing change

  `boltdocs` depends on `@bdocs/grammars`, so it installs on its own and every site gets the same 39 languages, the same seven themes and byte-identical highlighted output. Nothing to configure, nothing to import differently, no breaking change for a user.

  This is the reason it is a _dependency_ rather than an optional one. Making the grammars opt-in would have saved the same bytes but required every site using C++, Rust, PHP, Vue or any of the other 29 languages to know that and install a second package — trading a silent 2.6 MB for a silent broken code block.

  ### The split is along the existing seam

  The engine was already pluggable (`theme.codeHighlighting.engine` resolves through a registry that a plugin can extend). The grammars were not — they were hardcoded in `shiki-langs.ts`. Those are two different axes:
  - **engine** — which highlighter implementation. Already free.
  - **grammars** — which language tables. Now a package.

  Choosing a different engine still changes what consumes these; it does not change this package's role as the registry of languages.

  ### A build bug this surfaced

  `tsdown` emits a chunk for every `import('./grammars/x.mjs')` _and_ the copy step placed the original beside it. The first build of the package weighed 5.9 MB instead of 2.9 — two copies of every grammar. `neverBundle` on the grammar and theme directories is what makes the copied files the only ones; there is a comment at that line in `tsdown.config.ts` so the next person does not "simplify" it away.

  ### Verified

  `tests/node/grammar-loading.test.ts` in the core covers the seam: ten languages still register eagerly, a lazy one (`rust`) still resolves through its dynamic import, and `cpp` still loads with its four sibling grammars. The grammar suite moved with the data — including two new assertions that every vendored `.mjs` has a sibling `.d.mts`, and that this package declares no runtime dependency on the framework it serves.

### Patch Changes

- 4fb6ed1: Keep the ten common grammars registered eagerly. This records a measurement, because the change looked obviously right and was wrong.

  Moving `COMMON_LANGS` (html, js, ts, tsx, css, bash, json, markdown, python, go) to the lazy path saves 202 ms of synchronous CPU per highlighter construction — 6 ms with an empty set against 208 ms with those ten — which reads as a free win. It is not free, and it is not a win.

  Across three cold builds of the 257-page documentation site:

  |           | median                  |
  | --------- | ----------------------- |
  | ten eager | **31.9 s**              |
  | all lazy  | 50.1 s — **57% slower** |

  The saving is real and it moves to a place that costs more than it does. Grammars load once per Sätteri compile worker, and the pool runs several workers at once: parsing ten grammars in parallel at startup is cheap wall-clock time, while the lazy path serializes an import plus a TextMate compile into every worker that touches a code block, all contending for the same cores. Registering eagerly turns N per-worker loads into one per-worker batch, and the batching is the entire effect.

  The empty set would be correct for a site with no code blocks and is wrong for a documentation site, which is what this package exists for.

  The note lives on `COMMON_LANGS` rather than only here, because the argument that motivated the change — "202 ms is worth saving" — is the one that will be made again. `tests/node/grammar-loading.test.ts` asserts the eager set stays at ten and stays out of the lazy map, so the two lists cannot drift apart, and it keeps the tests that prove every language still loads on demand.

- 59b5f67: Three performance changes, and a grammar that was missing.

  **The theme's build surface is its own entry.**

  `createRoutes` and the shell are what the _build_ drives, not what a reader
  imports. They were in the theme's main entry, so every site that imported one
  component — `cn`, a `Link`, a hook — downloaded the route builder with it, and
  every page chunk carried a copy.

  They are published as `@bdocs/theme-neutral/ssg` now, and the engine imports
  them from there.

  |                                  | Before    | After         |
  | -------------------------------- | --------- | ------------- |
  | The theme's published main entry | 69,666 B  | **4,277 B**   |
  | The app chunk                    | 653,989 B | **491,923 B** |
  | The eager set, raw               | 966.2 kB  | **901.7 kB**  |
  | The eager set, gzip              | 236.7 kB  | **218.9 kB**  |
  | The whole client bundle          | 5.586 MB  | **5.524 MB**  |

  **A theme says where its entries live in source.**

  ```json
  { "boltdocs": { "source": { ".": "./src/index.ts" } } }
  ```

  The dev server and the build alias a theme's _source_ rather than its built
  copy, so an edit to a theme is picked up without rebuilding the package. Before,
  only the main entry was aliased: the subpaths resolved to a built file that
  could be minutes behind the source it was built from.

  **esbuild's asynchronous transform.**

  `transformSync` starts an esbuild service per call and tears it down
  afterwards; `transform` keeps one alive. Measured on a compiled page: 5.2 ms
  per call against 2.0 ms, and the difference is paid once per page. The cold
  build of the documentation site went from 27.4 s to 26.1 s, and the MDX
  precompile from 10.5 s to 9.8 s.

  **The `diff` grammar is bundled.**

  A ```diff block rendered without highlighting, and every build printed a
  warning about a language the framework did not have. It is a common language
  for documentation; it is in the bundle now.
