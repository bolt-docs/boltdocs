---
'@bdocs/theme-neutral': minor
'@bdocs/processor-satteri': patch
'@bdocs/grammars': patch
---

Three performance changes, and a grammar that was missing.

**The theme's build surface is its own entry.**

`createRoutes` and the shell are what the *build* drives, not what a reader
imports. They were in the theme's main entry, so every site that imported one
component — `cn`, a `Link`, a hook — downloaded the route builder with it, and
every page chunk carried a copy.

They are published as `@bdocs/theme-neutral/ssg` now, and the engine imports
them from there.

| | Before | After |
| --- | --- | --- |
| The theme's published main entry | 69,666 B | **4,277 B** |
| The app chunk | 653,989 B | **491,923 B** |
| The eager set, raw | 966.2 kB | **901.7 kB** |
| The eager set, gzip | 236.7 kB | **218.9 kB** |
| The whole client bundle | 5.586 MB | **5.524 MB** |

**A theme says where its entries live in source.**

```json
{ "boltdocs": { "source": { ".": "./src/index.ts" } } }
```

The dev server and the build alias a theme's *source* rather than its built
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
