---
'boltdocs': patch
'@bdocs/ssg': patch
---

OnThisPage always renders: stale critical CSS no longer survives client-side navigation, and collection posts resolve their route metadata

- **Stale critters inline styles removed after hydration.** Each pre-rendered
  page inlines a `<style data-zig-critters>` block containing the utilities
  that page uses. After a client-side navigation the first page's block stayed
  in `<head>`, emitted after the external stylesheet, so its `.hidden` (and
  any other shared utility) beat the stylesheet for the rest of the session —
  pages reached via SPA silently lost styles the landing never used (the
  OnThisPage rail is hidden by default and revealed by `xl:flex`, so it
  vanished on every SPA path). The shell now removes these blocks on mount;
  the external stylesheet is always present before hydration, so removal
  cannot cause a flash.
- **Collection posts resolve `currentRoute` on the client.** Collection post
  route records are registered without the docs base (and sometimes without a
  leading slash), while the browser URL carries both, so `useRoutes()` missed
  and every consumer of `currentRoute` (OnThisPage, navbar docs detection,
  edit links) received `undefined` on post pages. When the direct lookup
  misses, registered collection routes now fall back to the longest
  segment-tail match against the current pathname, restricted to
  `route.collection` so regular docs pages can never be shadowed.
- **Client hash includes the site's `src/` directory.** Theme layouts,
  components and styles are bundled by Vite like framework code but were not
  hashed, so a theme-only edit skipped the client build and every cached page
  silently kept the previous layout. `src/` now participates in the client
  code hash.
