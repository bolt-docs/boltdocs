import { use } from 'react'
import {
  LocationContext,
  NavigateContext,
  PrefetchContext,
  RouteDataContext,
  MatchesContext,
  type LocationState,
  type NavigateFunction,
} from './context'
import type { RouteMatch } from './types'

export function useLocation(): LocationState {
  return use(LocationContext)
}

export function useNavigate(): NavigateFunction {
  return use(NavigateContext)
}

export function usePrefetch(): (to: string) => Promise<void> {
  return use(PrefetchContext)
}

export function useRouteData<T = Record<string, unknown>>(): T {
  return use(RouteDataContext) as T
}

/** Alias for useRouteData — parity with react-router-dom's useLoaderData */
export function useLoaderData<T = Record<string, unknown>>(): T {
  return use(RouteDataContext) as T
}

export function useMatches(): RouteMatch[] {
  return use(MatchesContext)
}
