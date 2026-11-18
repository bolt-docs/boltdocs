/**
 * `@bdocs/theme-neutral` — the neutral theme.
 *
 * What a theme is: the components, the stylesheet and the `surface` object the
 * engine renders with. Navigation, locale state, search indexing and the route
 * table are the framework's, and they come from `@bdocs/runtime`; a second theme
 * imports them rather than copying them.
 *
 * The stylesheet ships with the package: `import '@bdocs/theme-neutral/css'`.
 *
 * Nothing here reads a `virtual:boltdocs-*` module. Those are resolved by the
 * Boltdocs Vite pipeline, which only the engine can reach, so the generated
 * per-site artifacts — the icon registry, the page-source fetcher, the search
 * index, the site's `layout.tsx` and its plugin slots — arrive through
 * `registerSiteBridge()` from `@bdocs/runtime` and are read back here.
 */

/** The object the engine renders this theme with. See `./surface`. */
export { surface, default as defaultSurface } from './surface'

export { default as DocsLayout } from './components/docs-layout-default'
export { DocPage } from './doc-page'
export { ShellFrame } from './components/shell-frame'
export { ExternalPage } from './components/external-page'
export { ExternalContent } from './components/external-content'
export { CollectionList } from './components/collection-list'

// The reusable UI layer (composition wrappers, assembled components, icon
// resolver and utilities) now lives in @bdocs/ui-base and is re-exported here
// so existing `@bdocs/theme-neutral` imports keep working.
export * from '@bdocs/ui-base'

// MDX components. `./mdx` is also the `boltdocs/mdx` subpath a site's
// `mdx-components.tsx` resolves against, so the two cannot drift.
export * from './mdx'
// The default MDX component map. A site that writes `mdx-components.tsx`
// merges its own components over this one, so it has to be importable.
export { mdxComponentsDefault } from './mdx-component'

// The document metadata helpers. The component itself lives in the runtime now
// that the engine renders the head; the re-export keeps the API a site already
// imports from here.
export {
  StructuredData,
  defineStructuredData,
  createArticleStructuredData,
  createBreadcrumbStructuredData,
  createStructuredData,
  createWebSiteStructuredData,
} from '@bdocs/runtime'
export type {
  StructuredDataProps,
  ArticleStructuredDataOptions,
  BreadcrumbStructuredDataItem,
  StructuredDataFactoryOptions,
  WebSiteStructuredDataOptions,
} from '@bdocs/runtime'

export { useCodeBlock } from './components/mdx/use-code-block'
export { useExpandable } from './components/mdx/use-expandable'
export type { UseExpandableOptions } from './components/mdx/use-expandable'
export { useCodeBlockFeedback } from './components/mdx/use-code-block-feedback'
export type {
  CodeBlockFeedbackPayload,
  UseCodeBlockFeedbackOptions,
} from './components/mdx/use-code-block-feedback'

export type * from './types'
