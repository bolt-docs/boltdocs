import { useContext } from 'react'
import {
  LocationContext,
  NavigateContext,
  RouteDataContext,
  MatchesContext,
  type LocationState,
  type NavigateFunction,
} from './context'

export function useLocation(): LocationState {
  return useContext(LocationContext)
}

export function useNavigate(): NavigateFunction {
  return useContext(NavigateContext)
}

export function useRouteData<T = any>(): T {
  return useContext(RouteDataContext) as T
}

export function useLoaderData<T = any>(): T {
  return useContext(RouteDataContext) as T
}

export function useMatches(): any[] {
  return useContext(MatchesContext)
}
