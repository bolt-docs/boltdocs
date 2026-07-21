---
'@bdocs/unist-utils': minor
'boltdocs': minor
'@bdocs/processor-satteri': minor
---

Phase 1 of the new plugin API. The unist/mdast/hast utilities that used to
live in `boltdocs/node/plugins/plugin-utils` (visit helpers, builders,
h-properties, class-list helpers) and the shiki-internal `parseMetaString`
move into a new public package: **`@bdocs/unist-utils`**.

For `boltdocs` core (no public-API impact): internal code now imports
directly from `@bdocs/unist-utils`. The old paths
(`boltdocs/node/plugins/plugin-utils` through barrel,
`packages/core/src/node/mdx/types`) keep working as a back-compat shim.

`parseMetaString` and the `ParsedMeta` interface also moved; shiki-adapter
re-imports them from the new package and the `__raw` field is now typed
as `string | undefined`.

The new package is `sideEffects: false`, ships with strict types end-to-end
and is published under the standard Boltdocs organisation namespace so
external plugin authors can adopt it directly. Migration notes for plugin
authors live in `packages/unist-utils/README.md`.
