/**
 * `@bdocs/ui-base` — the reusable UI layer of Boltdocs.
 *
 * It contains the composition wrappers over `@bdocs/primitives` and the
 * assembled UI components (navbar, sidebar, TOC, search dialog, …) with their
 * native CSS. It owns no routing, config or content state — those come from
 * `@bdocs/runtime`. The stylesheet ships as `import '@bdocs/ui-base/css'`.
 *
 * Nothing here reads a `virtual:boltdocs-*` module; the generated per-site
 * artifacts reach it through `registerSiteBridge()` from `@bdocs/runtime`.
 */

export * from './hooks/index'
export * from './ui-base/icons'

export { Link } from './composition/link'

export {
  getIconRegistry,
  normalizeIconExports,
  resolveIcon,
  IconRenderer,
} from './ui-base/icon-renderer'
export { SearchHighlight } from './ui-base/search-highlight'
export { Giscus } from './ui-base/giscus'
export { Navbar } from './ui-base/navbar'
export { Sidebar } from './ui-base/sidebar'
export { OnThisPage } from './ui-base/on-this-page'
export { Breadcrumbs } from './ui-base/breadcrumbs'
export { PageNav } from './ui-base/page-nav'
export { ErrorBoundary } from './ui-base/error-boundary'
export { CopyMarkdown, useCopyMarkdown } from './ui-base/copy-markdown'
export { NotFound } from './ui-base/not-found'
export { Banner } from './ui-base/banner'

export { cn } from './utils/cn'
export { reactToText } from './utils/react-to-text'
export { copyToClipboard } from './utils/copy-clipboard'
export {
  sanitizeSvgMarkup,
  clearSvgSanitizeCache,
} from './utils/sanitize-svg'
export { clearHighlights, highlightTerms } from './hooks/use-search-highlight'
export { useCopyButton } from './mdx/use-copy-button'
