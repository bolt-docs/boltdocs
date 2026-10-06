/**
 * `@bdocs/theme-neutral` — the neutral theme.
 *
 * This is the complete UI layer: every `ui-base` component, the MDX components,
 * the layout, and the hooks and utilities they need. A second theme is a second
 * package shaped like this one, depending on `@bdocs/runtime`,
 * `@bdocs/primitives` and `@bdocs/contracts` and nothing else. That is what makes
 * installing one a single dependency rather than a fork.
 *
 * The stylesheet ships with the package: `import '@bdocs/theme-neutral/css'`.
 *
 * This barrel is the theme's own public surface. It is deliberately close to what
 * `boltdocs/client` used to export, because `boltdocs/client` now re-exports this
 * package: the layout-level primitives stay behind `boltdocs/client/primitives`
 * rather than widening this entry point, which is the split that existed before.
 *
 * Nothing here reads a `virtual:boltdocs-*` module. Those are resolved by the
 * Boltdocs Vite pipeline, which only `@bdocs/core` can reach, so the generated
 * artifacts — the icon registry, the page-source fetcher, the search index, the
 * site's `layout.tsx` and its plugin slots — arrive through `registerSiteBridge()`
 * from `@bdocs/runtime` and are read back here.
 */

// The contexts and the router come from the runtime, re-exported rather than
// duplicated: a theme that called `useTheme()` from a second copy would read a
// different context object than the one the shell populated.
export {
  useConfig,
  useOptionalConfig,
  useTheme,
  useUI,
  useMdxComponents,
  useDocRoute,
  useRoutesContext,
  normalizePath,
  resolvePublicAssetUrl,
  getTranslated,
  startViewTransition,
  useViewTransition,
  type BoltdocsLocale,
  type BoltdocsRoutePath,
  type BoltdocsRoutePathWithFallback,
  type BoltdocsTypes,
  type BoltdocsVersion,
  type ViewTransitionHandle,
  type ViewTransitionOptions,
  type ViewTransitionRunner,
  type ViewTransitionUpdate,
} from '@bdocs/runtime'

/**
 * The composition surface: what a host shell has to wire.
 *
 * `boltdocs/client` and a custom entry point both assemble the app and need the
 * same provider stack, the default MDX map, the head shim and the collections
 * provider. These are plumbing rather than the theme's UI API, but they live on
 * this entry rather than a third one: each extra entry makes tsdown build a
 * shared chunk, and a shared chunk is what hoisted the search dialog's dynamic
 * import into a static one.
 */
export { BoltdocsProvider, useBoltdocsContext } from './store/boltdocs-context'
export { mdxComponentsDefault } from './mdx-component'
export { Helmet, HelmetProvider } from './helmet-compat'
export {
  CollectionsProvider,
  CollectionsContext,
  useCollectionsData,
} from './collections/collections-context'
export type { CollectionsData } from './collections/collections-context'
export { PluginFloatingSlots } from './components/plugin-floating-slots'

/**
 * Hands the generated per-site artifacts to the UI layer. Called once by the
 * core, the only package that can resolve a `virtual:boltdocs-*` module.
 */
export { registerSiteBridge } from '@bdocs/runtime'

export * from './hooks/index'
export * from './collections/index'

export { default as DocsLayout } from './components/docs-layout-default'
export { DocsLayout as DocsLayoutComposition } from './docs-layout'
export { DocPage } from './doc-page'
export { Head } from './head'
export { ScrollHandler } from './scroll-handler'
export { InternalErrorBoundary } from './components/internal/error-boundary'

// `Link` is the one layout primitive exported from here as well. Everything else
// in `components/primitives` stays behind `@bdocs/theme-neutral/components/primitives`,
// because that barrel reaches the search dialog and re-exporting it from `index`
// is what turned the search chunk from lazy into part of the first visit.
export { Link } from './components/primitives/link'

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

export { cn } from './utils/cn'
export { formatDate } from './collections/utils'
export { formatDeterministicDate } from './utils/date'
export { getStarsRepo } from './utils/github'
export { reactToText } from './utils/react-to-text'
export { copyToClipboard } from './utils/copy-clipboard'
export {
  sanitizeSvgMarkup,
  clearSvgSanitizeCache,
} from './utils/sanitize-svg'
export { getBaseFilePath } from './utils/get-base-file-path'
export { clearHighlights, highlightTerms } from './hooks/use-search-highlight'

export {
  StructuredData,
  defineStructuredData,
  createArticleStructuredData,
  createBreadcrumbStructuredData,
  createStructuredData,
  createWebSiteStructuredData,
} from './components/structured-data'
export type {
  StructuredDataProps,
  ArticleStructuredDataOptions,
  BreadcrumbStructuredDataItem,
  StructuredDataFactoryOptions,
  WebSiteStructuredDataOptions,
} from './components/structured-data'

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
