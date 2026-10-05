/**
 * Router entry point, kept so every existing `from '../router'` keeps working.
 *
 * The implementation moved to `@bdocs/runtime`. This file is the seam: code
 * inside core imports the router from here, and nothing outside the package has
 * to change when the boundary moves again.
 *
 * The names are written out rather than `export * from '@bdocs/runtime/router'`
 * for two reasons. `boltdocs/client/router` is a public subpath, so a wildcard
 * would republish whatever the runtime grows next under a path whose name
 * promises a router. And `rolldown-plugin-dts` — which builds the `.d.ts` —
 * crashes on a cross-package `export *`, because the re-export it synthesises
 * has a member expression where Babel demands an identifier. That one is a bug
 * in the plugin, not a decision, but the explicit list sidesteps it and makes the
 * surface auditable.
 *
 * `tests/runtime-seams.test.ts` pins this list.
 */
export {
  Outlet,
  OutletContext,
  NavigateContext,
  type NavigateFunction,
  PrefetchContext,
  type PrefetchFunction,
  LocationContext,
  type LocationState,
  LocationProvider,
  type LocationProviderProps,
  RouteDataContext,
  RouteRenderer,
  type RouteRendererProps,
  MatchesContext,
  type LoaderFunction,
  type LoaderFunctionArgs,
  type RouteRecord,
  type RouteMatch,
  type RouterOptions,
  type ResolveUrlOptions,
  type LazyRouteResult,
  type CreateRoutesResult,
  type UrlRouteHint,
  type UrlRouteKind,
  type UrlContractConfig,
  type BuildUrlOptions,
  type ParsedUrl,
  useLocation,
  useNavigate,
  usePrefetch,
  useRouteData,
  useLoaderData,
  useMatches,
  defaultNavigate,
  hasBasename,
  addBasename,
  stripBasename,
  hasUrlBase,
  addUrlBase,
  stripUrlBase,
  normalizeUrlBase,
  normalizeUrlPath,
  hasUriScheme,
  stripSiteProtocol,
  resolveUrlReference,
  parseUrlReference,
  splitUrlReference,
  buildUrl,
  classifyUrlPath,
  getConfiguredLocales,
  isConfiguredLocale,
  getConfiguredVersions,
  isConfiguredVersion,
  getVersionSegments,
  getVersionPrefixSegments,
  matchRouteBranch,
  matchRouteBranchWithParams,
  resolveRouteBranch,
  observeForPrefetch,
  resetViewportPrefetchObserver,
} from '@bdocs/runtime/router'
