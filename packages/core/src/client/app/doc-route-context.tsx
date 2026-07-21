import { createContext, useContext, use } from 'react'
import type { ComponentRoute } from '../types'

/**
 * Context that exposes the currently active route to every primitive in the
 * tree. Slot renderers and other primitives consume it via `useDocRoute()`
 * instead of calling `useRoutes()` directly so a single computation is shared
 * across the whole layout.
 *
 * `undefined` means "no active route" (e.g. on a not-found page or before the
 * routes context has hydrated).
 */
const DocRouteContext = createContext<ComponentRoute | undefined>(undefined)

export function DocRouteProvider({
  value,
  children,
}: {
  value: ComponentRoute | undefined
  children: React.ReactNode
}) {
  return (
    <DocRouteContext.Provider value={value}>
      {children}
    </DocRouteContext.Provider>
  )
}

/**
 * Read the current route from context. Returns `undefined` if no provider
 * is mounted in the tree (e.g. a custom layout that opted out).
 */
export function useDocRoute(): ComponentRoute | undefined {
  return use(DocRouteContext)
}

export { DocRouteContext }
