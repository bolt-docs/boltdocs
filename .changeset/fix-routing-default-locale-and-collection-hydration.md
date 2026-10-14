---
'boltdocs': patch
---

Fix two routing bugs that broke server-rendered pages

**External pages under the default locale returned 404.** `getLocalizedPaths`
looped over every configured locale to build the localized variants of an
external page, including the default one. That minted a second URL for the same
page, and on a site served under a base the SSG wrote `/docs/en/about` — a
document the build itself generated and the client router never learned about,
because the base is not part of the route. Visitors got a 404 on a page that
existed. The default locale is now skipped; it is already the unprefixed path.

**Collection posts failed hydration.** `MdxPage` decided between the collection
layout and the documentation layout by inspecting the route's loader data. The
generated client entry declares `hasLoaderData={false}`, so the first client
render runs with no loader data at all, and the layout came out wrong: the
server had sent the collection layout and the client rendered the documentation
one. React compared two different first children and threw the whole page away
(error #418), re-rendering every node.

The layout is now decided from the route table, which is known synchronously,
with the loader kept as a fallback for callers that render `MdxPage` directly.
A project declaring a collection does not have to know about any of this.
