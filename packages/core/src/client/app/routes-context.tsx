import { createContext, use, useEffect, useMemo, useState } from 'react'
import type { ComponentRoute } from '../types'
import type { UrlRouteHint } from '../router'
import { normalizePath } from '../utils/path'

export interface RouteIndex {
  byPath: ReadonlyMap<string, ComponentRoute>
  hintsByPath: ReadonlyMap<string, UrlRouteHint>
  collectionNames: readonly string[]
}

interface RoutesContextType {
  routes: ComponentRoute[]
  index: RouteIndex
}

const emptyRouteIndex: RouteIndex = {
  byPath: new Map(),
  hintsByPath: new Map(),
  collectionNames: [],
}

const RoutesContext = createContext<RoutesContextType>({
  routes: [],
  index: emptyRouteIndex,
})

/**
 * Hook to access the processed routes list from the closest provider.
 */
export function useRoutesContext() {
  return use(RoutesContext)
}

interface FrontmatterDeltaPayload {
  routes: {
    updated: ComponentRoute[]
    deleted: string[]
  }
}

/**
 * Provider component for the documentation routes.
 */
export function RoutesProvider({
  routes: initialRoutes,
  children,
}: {
  routes: ComponentRoute[]
  children: React.ReactNode
}) {
  const [routes, setRoutes] = useState(initialRoutes)

  const index = useMemo<RouteIndex>(() => {
    const byPath = new Map<string, ComponentRoute>()
    const hintsByPath = new Map<string, UrlRouteHint>()
    const collectionNames = new Set<string>()

    for (const route of routes) {
      if (!route.path) continue
      const path = normalizePath(route.path)
      byPath.set(path, route)
      hintsByPath.set(path, {
        path: route.path,
        kind: route.collection ? 'collection' : undefined,
        collection: route.collection,
      })
      if (route.collection) collectionNames.add(route.collection)
    }

    return {
      byPath,
      hintsByPath,
      collectionNames: [...collectionNames],
    }
  }, [routes])

  useEffect(() => {
    if (!import.meta.hot) return

    const handler = (payload: FrontmatterDeltaPayload) => {
      setRoutes((prev) => {
        const deleted = new Set(payload.routes.deleted)
        const next = prev.filter((r) => !deleted.has(r.path))
        for (const updated of payload.routes.updated) {
          const idx = next.findIndex((r) => r.path === updated.path)
          if (idx >= 0) {
            next[idx] = updated
          } else {
            next.push(updated)
          }
        }
        return [...next]
      })
    }

    const hot = import.meta.hot
    hot.on('boltdocs:frontmatter-update', handler)
    return () => hot.off?.('boltdocs:frontmatter-update', handler)
  }, [])

  return (
    <RoutesContext.Provider value={{ routes, index }}>
      {children}
    </RoutesContext.Provider>
  )
}
