---
'boltdocs': major
'@bdocs/contracts': minor
'@bdocs/runtime': minor
'@bdocs/processor-satteri': patch
'@bdocs/plugin-git-meta': patch
'@bdocs/plugin-llms-text': patch
'@bdocs/plugin-rss': patch
'@bdocs/plugin-seo': patch
'@bdocs/plugin-search-algolia': patch
---

The engine depends on nothing but the contracts.

The package graph, measured from the manifests:

```text
@bdocs/contracts   (no dependencies)
@bdocs/primitives  (no dependencies)
@bdocs/runtime     → @bdocs/contracts
@bdocs/theme-neutral → @bdocs/contracts, @bdocs/primitives, @bdocs/runtime
@bdocs/ssg         → @bdocs/contracts
boltdocs (engine)  → @bdocs/contracts, @bdocs/processor-satteri, @bdocs/ssg
```

**The `Boltdocs` global namespace moved to `@bdocs/contracts`.**

It is augmented by the generated route types, and TypeScript rejects two
`declare global` blocks for the same namespace, so it has exactly one home. It
lived in `@bdocs/runtime`, which made the engine's re-export a type-only
dependency on the browser half — one that compiles, ships nothing, and was
therefore invisible in every install-size measurement.

The contract layer cannot name React, so the MDX component map became a
generic there, and `@bdocs/runtime` instantiates it with `ComponentType`. The
shape a consumer sees is unchanged.

**The engine declares no peer dependency at all.**

It renders nothing. React, React DOM and the router are the browser half's
business, and the browser half is a package the site installs. A site that
installs a theme already installs React; a site that does not should not be
made to.

**The plugins read the contract types from the contracts.**

`RouteMeta`, `SearchIndexParams` and `RouteContributor` now come from
`@bdocs/contracts` rather than from the engine, so a plugin can be written
against the contract layer alone. The engine-bound types — `PluginContext` and
`BoltdocsPlugin`, which are the contracts' generics bound to the engine's
config and to Node's request and response types — still come from the engine,
because that binding is the value the plugin gets from it.
