import type { ReactNode, ComponentType } from 'react'

export interface LoaderFunctionArgs {
  request: Request
  params: Record<string, string>
}

export type LoaderFunction<T = unknown> = (
  args: LoaderFunctionArgs,
) => Promise<T> | T

export type PrefetchFunction = (to: string) => Promise<void>

export interface RouteMatch {
  route: RouteRecord
  params: Record<string, string>
  pathname: string
  pathnameBase: string
  data?: Record<string, unknown>
}

/**
 * `ComponentType` with no type argument, which resolves to `ComponentType<any>`
 * — React's own default. Written this way because spelling out the `any` says
 * something untrue about the code: these props are not unchecked, they are as
 * loosely typed as React's own component type, which is the ceiling here.
 */
export interface LazyRouteResult {
  Component?: ComponentType
  element?: ReactNode
  loader?: LoaderFunction
  ErrorBoundary?: ComponentType
}

/** Structurally compatible with react-router-dom's route objects */
export interface RouteRecord {
  path?: string
  index?: boolean
  id?: string
  element?: ReactNode
  Component?: ComponentType
  loader?: LoaderFunction
  /**
   * Declared for structural compatibility with react-router's `RouteObject` and
   * never called from this package. `never[]` rather than `any[]` because a
   * parameter position accepts `never` for any function, so this stays as
   * permissive as it was without inviting a call site to pass anything.
   */
  action?: (...args: never[]) => unknown
  ErrorBoundary?: ComponentType
  hasErrorBoundary?: boolean
  HydrateFallback?: ComponentType
  children?: RouteRecord[]
  lazy?: () => Promise<LazyRouteResult>
  caseSensitive?: boolean
  shouldRevalidate?: (...args: never[]) => boolean
  getStaticPaths?: () => string[] | Promise<string[]>
  entry?: string
  /** Locale this route belongs to (used by i18n fallbacks) */
  locale?: string
}

export interface RouterOptions {
  routes: RouteRecord[]
  basename?: string
  future?: Record<string, boolean>
}

export interface RouteRendererProps {
  routes: RouteRecord[]
  pathname?: string
  loaderData?: Record<string, unknown> | null
  /** Whether loaderData was explicitly produced for the initial SSR route. */
  hasLoaderData?: boolean
  /** Resolved branch supplied by SSR so lazy MDX routes render without effects. */
  resolvedBranch?: RouteRecord[]
  basename?: string
  /** Default locale is omitted from external URLs. */
  defaultLocale?: string
  /** Optional route prefetcher used by Link hover/focus interactions. */
  prefetch?: PrefetchFunction
  /** Enables native View Transitions for route updates. */
  viewTransitions?: boolean | { enabled?: boolean; types?: string[] }
}

export interface CreateRoutesResult {
  routes: RouteRecord[]
  RouteRenderer: ComponentType<RouteRendererProps>
  matchRouteBranch: (routes: RouteRecord[], pathname: string) => RouteRecord[]
  matchRouteBranchWithParams: (
    routes: RouteRecord[],
    pathname: string,
    basename?: string,
  ) => Array<{
    route: RouteRecord
    params: Record<string, string>
  }>
  resolveRouteBranch: (branch: RouteRecord[]) => Promise<RouteRecord[]>
}
