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

export * from './hooks/index'

// `Link` is the one layout primitive exported from here as well. Everything else
// in `components/composition` stays behind `@bdocs/theme-neutral/composition`,
// because that barrel reaches the search dialog and re-exporting it from `index`
// is what turned the search chunk from lazy into part of the first visit.
export { Link } from './components/composition/link'

// The icon resolver, because a custom layout that renders an icon by name needs
// the same lookup the theme uses — and needs to read the site's registry rather
// than reaching into `virtual:boltdocs-icons`, which it cannot resolve.
export {
  getIconRegistry,
  normalizeIconExports,
  resolveIcon,
  IconRenderer,
} from './components/ui-base/icon-renderer'
export { SearchHighlight } from './components/ui-base/search-highlight'
export { Giscus } from './components/ui-base/giscus'
export { Navbar } from './components/ui-base/navbar'
export { Sidebar } from './components/ui-base/sidebar'
export { OnThisPage } from './components/ui-base/on-this-page'
export { Breadcrumbs } from './components/ui-base/breadcrumbs'
export { PageNav } from './components/ui-base/page-nav'
export { ErrorBoundary } from './components/ui-base/error-boundary'
export { CopyMarkdown } from './components/ui-base/copy-markdown'
export { NotFound } from './components/ui-base/not-found'
export { Banner } from './components/ui-base/banner'

// MDX components. `./mdx` is also the `boltdocs/mdx` subpath a site's
// `mdx-components.tsx` resolves against, so the two cannot drift.
export * from './mdx'
// The default MDX component map. A site that writes `mdx-components.tsx`
// merges its own components over this one, so it has to be importable.
export { mdxComponentsDefault } from './mdx-component'

export { cn } from './utils/cn'
export { reactToText } from './utils/react-to-text'
export { copyToClipboard } from './utils/copy-clipboard'
export {
  sanitizeSvgMarkup,
  clearSvgSanitizeCache,
} from './utils/sanitize-svg'
export { clearHighlights, highlightTerms } from './hooks/use-search-highlight'

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
export { useCopyButton } from './components/mdx/use-copy-button'
export { useExpandable } from './components/mdx/use-expandable'
export type { UseExpandableOptions } from './components/mdx/use-expandable'
export { useCodeBlockFeedback } from './components/mdx/use-code-block-feedback'
export type {
  CodeBlockFeedbackPayload,
  UseCodeBlockFeedbackOptions,
} from './components/mdx/use-code-block-feedback'

export type * from './types'
