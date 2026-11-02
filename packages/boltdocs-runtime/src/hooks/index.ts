/**
 * The navigation hooks.
 *
 * Each one derives from the route table and the active locale/version, and each
 * one is read by a theme rather than owned by it: a second theme has the same
 * sidebar, the same neighbours and the same breadcrumbs because it asks the
 * same questions, not because it copied the answers.
 */
export {
  useRoutes,
  findCurrentCollectionRoute,
  selectRoutesForContext,
} from './use-routes'
export { useSidebar, isRouteActive, hasChildren } from './use-sidebar'
export type {
  SidebarGroupData,
  MergedSidebarItem,
  SidebarNode,
} from './use-sidebar'
export { useNavbar } from './use-navbar'
export { usePageNav } from './use-page-nav'
export { useBreadcrumbs } from './use-breadcrumbs'
export { useHeadings } from './use-headings'
export { useI18n } from './use-i18n'
export type { LocaleOption, UseI18nReturn } from './use-i18n'
export { useVersion } from './use-version'
export type { VersionOption, UseVersionReturn } from './use-version'
export { useSearch, applySearchDelta } from './use-search'
export type { SearchResult, SearchStatus, SearchHotContext } from './use-search'
export { useLocalizedTo } from './use-localized-to'
export {
  useAnalytics,
  useTrackPageView,
  useTrackEvent,
} from './use-analytics'
export type {
  AnalyticsEvent,
  AnalyticsInstance,
  UseAnalyticsOptions,
} from './use-analytics'
export { useMergedComponents } from './use-merged-components'
