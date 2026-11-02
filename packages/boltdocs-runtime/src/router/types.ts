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
 * A component that accepts anything, for the react-router compatibility fields.
 *
 * `ComponentType`'s default type argument is `{}` in these `@types/react`, so
 * leaving it off would mean "takes no props" and reject every real route object
 * a site writes.
 */
// biome-ignore lint/suspicious/noExplicitAny: see above
export type AnyPropsComponent = ComponentType<any>

export interface LazyRouteResult {
  Component?: AnyPropsComponent
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
  Component?: AnyPropsComponent
  loader?: LoaderFunction
  /**
   * Declared for structural compatibility with react-router's `RouteObject` and
   * never called from this package. `never[]` rather than `any[]` because a
   * parameter position accepts `never` for any function, so this stays as
   * permissive as it was without inviting a call site to pass anything.
   */
  action?: (...args: never[]) => unknown
  ErrorBoundary?: AnyPropsComponent
  hasErrorBoundary?: boolean
  HydrateFallback?: AnyPropsComponent
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
