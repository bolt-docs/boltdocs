import type { ComponentType, ReactNode } from 'react'

export interface LoaderFunctionArgs {
  request: Request
  params: Record<string, string>
}

export type LoaderFunction = (
  args: LoaderFunctionArgs,
) => Promise<unknown> | unknown

export interface RouterRouteRecord {
  path?: string
  index?: boolean
  id?: string
  element?: ReactNode
  Component?: ComponentType<any>
  loader?: LoaderFunction
  action?: (...args: any[]) => unknown
  children?: RouterRouteRecord[]
  lazy?: () => Promise<Record<string, unknown>>
  getStaticPaths?: () => string[] | Promise<string[]>
  entry?: string
  locale?: string
}

export interface RouterRouteMatch {
  route: RouterRouteRecord
  params: Record<string, string>
}

export type MatchRouteBranchWithParams = (
  routes: RouterRouteRecord[],
  pathname: string,
  basename?: string,
) => RouterRouteMatch[]

export interface RouterRendererProps {
  routes: RouterRouteRecord[]
  pathname?: string
  loaderData?: Record<string, unknown> | null
  hasLoaderData?: boolean
  resolvedBranch?: RouterRouteRecord[]
  basename?: string
}

export interface RouterContextData {
  loaderData?: Record<string, unknown>
  actionData?: unknown
  errors?: unknown
}

export interface RouterEntryModule {
  RouteRenderer?: ComponentType<RouterRendererProps>
  matchRouteBranch?: (
    routes: RouterRouteRecord[],
    pathname: string,
  ) => RouterRouteRecord[]
  matchRouteBranchWithParams?: MatchRouteBranchWithParams
  resolveRouteBranch?: (
    branch: RouterRouteRecord[],
  ) => Promise<RouterRouteRecord[]>
}

export type RequiredRouterEntryModule = {
  RouteRenderer: ComponentType<RouterRendererProps>
  matchRouteBranchWithParams: MatchRouteBranchWithParams
  resolveRouteBranch: (
    branch: RouterRouteRecord[],
  ) => Promise<RouterRouteRecord[]>
}

export function withRouteIds(
  routes: RouterRouteRecord[],
  parentId = '',
): RouterRouteRecord[] {
  return routes.map((route, index) => {
    const id = route.id || (parentId ? `${parentId}-${index}` : String(index))
    return {
      ...route,
      id,
      children: route.children
        ? withRouteIds(route.children, id)
        : route.children,
    }
  })
}

export function requireRouterEntryModule(
  entryMod: RouterEntryModule | undefined,
): RequiredRouterEntryModule {
  if (
    !entryMod?.RouteRenderer ||
    !entryMod.matchRouteBranchWithParams ||
    !entryMod.resolveRouteBranch
  ) {
    throw new Error(
      'The SSR entry must expose RouteRenderer, matchRouteBranchWithParams, and resolveRouteBranch',
    )
  }

  return {
    RouteRenderer: entryMod.RouteRenderer,
    matchRouteBranchWithParams: entryMod.matchRouteBranchWithParams,
    resolveRouteBranch: entryMod.resolveRouteBranch,
  }
}
