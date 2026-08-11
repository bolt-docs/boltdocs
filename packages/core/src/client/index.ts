export type * from './types'
export type {
  CollectionPostLoaderData,
  CollectionListLoaderData,
} from './types'
export type {
  BoltdocsLocale,
  BoltdocsVersion,
  BoltdocsTypes,
} from '../shared/types'
export * from './ssg'
export { useConfig } from './app/config-context'
export { useTheme } from './app/theme-context'
export { useMdxComponents } from './app/mdx-components-context'
export { useUI } from './app/ui-context'
export * from './router'
export * from './hooks/index'
export { default as DocsLayout } from './components/docs-layout-default'
export { Navbar } from './components/ui-base/navbar'
export { Sidebar } from './components/ui-base/sidebar'
export { OnThisPage } from './components/ui-base/on-this-page'
export { Breadcrumbs } from './components/ui-base/breadcrumbs'
export { PageNav } from './components/ui-base/page-nav'
export { ErrorBoundary } from './components/ui-base/error-boundary'
export { CopyMarkdown } from './components/ui-base/copy-markdown'
export { SearchDialog } from './components/ui-base/search-dialog'
export { NotFound } from './components/ui-base/not-found'
export { Banner } from './components/ui-base/banner'

// Collections
export * from './collections/index'

// MDX components (compound re-exports)
export { Timeline } from './components/mdx/timeline'
export type {
  TimelineProps,
  TimelineItemProps,
  TimelineBadgeConfig,
  TimelineVariant,
} from './components/mdx/timeline'

// Utilities
export { cn } from './utils/cn'
export { resolvePublicAssetUrl } from './utils/path'
export { getTranslated } from './utils/i18n'
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
export { startViewTransition, useViewTransition } from './view-transitions'
export type {
  ViewTransitionHandle,
  ViewTransitionOptions,
  ViewTransitionRunner,
  ViewTransitionUpdate,
} from './view-transitions'
export { reactToText } from './utils/react-to-text'
export { copyToClipboard } from './utils/copy-clipboard'
export { getStarsRepo } from './utils/github'
export { useCodeBlock } from './components/mdx/use-code-block'
