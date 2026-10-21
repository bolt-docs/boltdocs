---
'boltdocs': major
'@bdocs/theme-neutral': major
'@bdocs/runtime': minor
'@bdocs/plugin-mermaid': patch
'@bdocs/plugin-git-meta': patch
'@bdocs/plugin-ask-ai': patch
---

The engine no longer ships the UI layer.

Until 4.0 the `boltdocs` package carried the whole client stack: the layout,
the components, the contexts, the router and the MDX components. A site got
all of it by installing the engine, and reached it through `boltdocs/client`,
`boltdocs/primitives` and `boltdocs/mdx`.

In 4.0 the engine is the engine.

### What moved

- The client code — the route builder, the shell, the MDX page, the collection
  routes — is now in `@bdocs/theme-neutral`. It renders the theme's
  components, so the engine could not keep it without depending on a theme.
- `boltdocs` no longer exports `./client`, `./client/router`, `./primitives` or
  `./mdx`. It publishes the engine: the CLI, the config, the route generation,
  the plugin lifecycle, the SSG bridge (`./ssg`) and the engine stylesheet
  (`./theme/reset.css`).
- The theme is resolved from the project, not from the engine. `themePackage`
  in the configuration names it (default `@bdocs/theme-neutral`), and the
  engine imports the route surface from it. A second theme is a second
  package, not a fork of the engine.

### What a site has to do

```bash
pnpm add @bdocs/theme-neutral
npx boltdocs migrate --apply
```

The command splits a `boltdocs/client` import by name: every symbol goes to
the package that exports it — components, layout and MDX components to
`@bdocs/theme-neutral`, the router and the contexts to `@bdocs/runtime`. It
rewrites the import examples in Markdown as well, and it adds the theme to
the manifest.

| 3.x | 4.0 |
| --- | --- |
| `boltdocs/client` (components, layout, hooks) | `@bdocs/theme-neutral` |
| `boltdocs/client` (router, contexts) | `@bdocs/runtime` |
| `boltdocs/primitives` | `@bdocs/theme-neutral/composition` |
| `boltdocs/mdx` | `@bdocs/theme-neutral` |
| `boltdocs/client/router` | `@bdocs/runtime/router` |

### How the two halves still meet

The generated per-site artifacts — the icon registry, the page-source fetcher,
the search index, the site's `layout.tsx`, the plugin slots and the site's own
MDX components — reach the theme through the runtime's site bridge, which the
engine fills from a generated `virtual:boltdocs-site-bridge` module. The
theme still mentions no virtual module, which is what lets it be installed on
its own.

The official plugins were moved the same way: a plugin's client code imports
`@bdocs/runtime` for the contexts and `@bdocs/primitives` for the style-neutral
helpers, so a plugin works with whatever theme the site uses.
