import virtualIcons from 'virtual:boltdocs-icons'
import virtualPageSource from 'virtual:boltdocs-page-source'
import virtualSearchData from 'virtual:boltdocs-search'
import virtualLayout from 'virtual:boltdocs-layout'
import virtualClientRegistry from 'virtual:boltdocs-client-registry'

import { registerSiteBridge } from '@bdocs/runtime'

/**
 * Hands the generated per-site artifacts to the UI layer.
 *
 * This module is the entire dependency between the Boltdocs Vite pipeline and
 * `@bdocs/theme-neutral`. It is here, in the core, because the core is the only
 * package that can resolve a `virtual:boltdocs-*` module — and it is the only
 * one that knows a given site has an icon registry, a page-source fetcher, a
 * search index, a `layout.tsx` or plugin slots. The theme reads them back
 * through `@bdocs/runtime`'s `getSiteIcons()` and friends, and mentions no
 * virtual module at all, which is what lets it be published and installed on its
 * own.
 *
 * Registered at module scope rather than inside a component: the reads happen
 * during render of arbitrary descendants, and a registration that happened after
 * the first paint would have those reads see the empty defaults. Module scope
 * runs before the entry component does, so the values are always there.
 *
 * Merged rather than assigned, so a partial artifact — a site with no search
 * index, say — does not blank out the others.
 */
registerSiteBridge({
  icons: virtualIcons,
  fetchPageSource: virtualPageSource,
  fetchSearchData: virtualSearchData,
  layout: virtualLayout,
  clientSlots: virtualClientRegistry,
})
