---
'@bdocs/plugin-search': minor
'boltdocs': major
---

Move search document generation into `@bdocs/plugin-search`, and drop `flexsearch` from the core.

The 4.0 roadmap names Search among the integrations `@bdocs/core-node` must not import: "`@bdocs/core-node` will own configuration resolution, route generation, frontmatter validation, plugin lifecycle, build orchestration, dev-server state, and invalidation. It will not import optional integrations such as Mermaid, Math, Ask AI, **Search**, RSS, or image optimization."

```bash
pnpm add @bdocs/plugin-search
```

```ts
import searchPlugin from '@bdocs/plugin-search'

export default defineConfig({ plugins: [searchPlugin()] })
```

Without it the build emits no `search.json` and prints one informational line. `boltdocs migrate` adds the import and the call for you.

## `flexsearch` was dead weight

It sat in the core's `dependencies` and was imported nowhere in its source. It is the *query* engine, and it belongs to whoever reads the index — `@bdocs/theme-neutral` for the built-in dialog — not to the process that writes the file. Every install paid for it.

## A registry, not a dependency

The dependency runs the other way. The core exposes `boltdocs/node/search` and the plugin registers a generator into it. Both alternatives were tried:

- **A `dependencies` entry from core to plugin** is a workspace cycle — the plugin needs `boltdocs` for its config types — and it would make search mandatory for every site, the exact coupling this change removes.
- **Keeping the generator inline** duplicates the code and fails the same requirement.

First registration wins, so two plugins generating `search.json` cannot make its contents depend on plugin load order — the rule `registerPluginHighlighter` already follows.

The plugin reaches the registry through the core (`await import('boltdocs/node/search')`) rather than importing it directly. A static import resolves to this package's **built** copy of the registry while the core reads its **source** copy: two module instances, one empty registry, and a site that configured the plugin and still got no `search.json`. That was the first implementation, and `SearchNoticeStep` caught it on the first build.

## Why the notice is `info`, not `warn`

Losing `@bdocs/plugin-seo` costs `sitemap.xml` and `robots.txt`, which nothing reports until search traffic stops arriving weeks later. Losing the search plugin costs a dialog that returns nothing — visible the moment someone types in it, and a deliberate choice for a site that never wanted one. Escalating it would train people to ignore build output.

`SearchNoticeStep` runs *after* `RoutesEnrich`, because that is the step that fires the `build:routes` hook the plugin registers in. Before it, the notice fired on every build of every site that had correctly configured the plugin.

## Two document shapes, deliberately

`SearchResultDocument` (core registry) carries `url` and `display` — the deep link and the breadcrumb, which is all a query layer needs. `SearchDocument` (`@bdocs/contracts`) carries `path`, `headings` and raw `frontmatter`, and is the *input* an engine plugin receives. They are not unified: an engine plugin should not have to re-derive the breadcrumb, and the runtime asset should not carry frontmatter no query engine reads.

## Verified

11 generator tests, 5 registry tests, 3 notice tests. The documentation site emits 2095 documents in a 1.08 MB `search.json`, byte-identical to what the core produced before the move.
