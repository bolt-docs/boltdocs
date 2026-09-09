export {
  LocationContext,
  NavigateContext,
  PrefetchContext,
  RouteDataContext,
  MatchesContext,
  LocationProvider,
  defaultNavigate,
  type LocationState,
  type NavigateFunction,
  type PrefetchFunction,
  type LocationProviderProps,
} from './context'

export {
  useLocation,
  useNavigate,
  usePrefetch,
  useRouteData,
  useLoaderData,
  useMatches,
} from './hooks'

export { Outlet, OutletContext } from './outlet'

export {
  RouteRenderer,
  matchRouteBranch,
  matchRouteBranchWithParams,
  resolveRouteBranch,
} from './renderer'

export {
  normalizeBasename,
  hasBasename,
  stripBasename,
  addBasename,
} from './utils'

export {
  normalizeUrlBase,
  normalizeUrlPath,
  hasUrlBase,
  stripUrlBase,
  addUrlBase,
  getConfiguredLocales,
  getConfiguredVersions,
  getVersionPrefixSegments,
  getVersionSegments,
  isConfiguredLocale,
  isConfiguredVersion,
  splitUrlReference,
  stripSiteProtocol,
  classifyUrlPath,
  parseUrlReference,
  buildUrl,
  resolveUrlReference,
  hasUriScheme,
} from './url-contract'

export type {
  UrlRouteKind,
  UrlContractConfig,
  UrlRouteHint,
  ParsedUrl,
  BuildUrlOptions,
  ResolveUrlOptions,
} from './url-contract'

export type {
  RouteRecord,
  RouteMatch,
  LoaderFunction,
  LoaderFunctionArgs,
  LazyRouteResult,
  RouterOptions,
  CreateRoutesResult,
  RouteRendererProps,
} from './types'
