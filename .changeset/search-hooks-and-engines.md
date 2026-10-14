---
'@bdocs/plugin-search': minor
'@bdocs/plugin-search-algolia': minor
'@bdocs/plugin-search-pagefind': minor
'@bdocs/contracts': minor
'boltdocs': major
---

Finish search: the `search:index` hook works, and two real engines ship.

## The hook existed and nothing called it

`search:index` was declared in `@bdocs/contracts` and implemented in
`core/src/node/plugins/search-contract.ts` — 58 lines whose comment named
FlexSearch, Pagefind, Algolia and Meilisearch as destinations — with zero call
sites. `SearchIndexStep` fires it now, between the type generation and the SSG
render, so an engine that only needs metadata (Algolia) finishes inside the
build.

The step refreshes the virtual-module search cache afterwards. Without that the
client bundle emitted whatever the module cache held from *before* the step ran,
which is how a site that configured the plugin stopped shipping `search.json`
while the pipeline reported the step as completed in 92 ms.

## Two document shapes, named

`SearchDocument` is the engine-facing **input**: a page with its headings and
frontmatter. `SearchIndexEntry` is what reaches the browser: `url` and
`display`, no frontmatter. They were one type in `search-contract.ts` and
another in the registry; an engine plugin compiled against the contracts one and
received the registry one.

They stay separate. An engine that indexes a page wants everything about it; a
browser rendering a result wants a link and a label. Carrying frontmatter into
a 1 MB asset to satisfy an engine that never reads it costs every visitor bytes,
and making each engine re-derive a breadcrumb means each implements it slightly
differently.

`createSearchDocuments` now imports the contracts type instead of declaring a
third copy.

## `@bdocs/plugin-search-algolia`

The client half of Algolia support shipped long before the build half.
`useSearch` reads `integrations.search.algolia`, queries an index, and parses
`hierarchy`, `anchor` and `_snippetResult` off every hit — and nothing ever
uploaded anything. A configured site got an empty result set with no error
anywhere: every part reported success.

The records are generated against the field names the client already reads, not
against a shape invented here. An index that queries successfully and renders
blank rows is the failure this avoids.

`adminApiKey` is build-time only and read from the environment; the search-only
key stays in `integrations.search.algolia`, which is what reaches the browser.
A failed upload warns and continues — the site built, the previous index still
serves, and failing a deploy over a search index is the wrong trade.

## Incremental uploads

`incremental: true` fingerprints each record and sends only what changed. A full
push on every build re-sends every record, which on a 2000-page site is
thousands of needless operations and a quota bill on Algolia's free tier.

Records that disappear upstream are **deleted** from the index. Leaving them
means a deleted page keeps answering searches, the reader follows the link, and
the 404 is indistinguishable from a broken search.

Off by default: the fingerprint lives in memory, so it only helps a process that
stays alive across builds.

## `@bdocs/plugin-search-pagefind`

Wired to `build:generate`, not `search:index` — Pagefind crawls the **built
HTML**, so the output has to exist first. It indexes exactly what a visitor sees,
including prose from MDX components that never touched frontmatter.

A missing binary warns and the build continues. The indexer is an optional peer
(`@pagefind/linux-x64`, `@pagefind/darwin-arm64`, …) so a site downloads only
its platform's binary.

## Detection

`boltdocs migrate` reports Algolia configured for the client with no uploader —
the asymmetry that makes search silently return nothing. Reported as `manual`:
an upload needs an admin key, and a codemod that invents one produces a build
that fails on the first request.

**Verified:** 1011 core, 26 search, 20 Algolia, 8 Pagefind, 36 contracts, 188
SSG, 120 Sätteri. The documentation site emits 2095 documents, byte-identical to
before this change.
