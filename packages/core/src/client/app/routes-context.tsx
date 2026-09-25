import { createContext, use, useEffect, useMemo, useState } from 'react'
import type { ComponentRoute } from '../types'
import type { UrlRouteHint } from '../router'
import { normalizePath } from '../utils/path'

export interface RouteIndex {
  byPath: ReadonlyMap<string, ComponentRoute>
  hintsByPath: ReadonlyMap<string, UrlRouteHint>
  collectionNames: readonly string[]
  /**
   * Collection routes can be registered without the configured documentation
   * base. This structural index removes the route's collection prefix and all
   * preceding URL segments, allowing the hook to resolve the exact content
   * path without scanning every route for an arbitrary tail match.
   */
  byCollectionPath?: ReadonlyMap<string, readonly ComponentRoute[]>
  /** Number of generated variants sharing each source file. */
  countsByFilePath?: ReadonlyMap<string, number>
}

interface RoutesContextType {
  routes: ComponentRoute[]
  index: RouteIndex
}

const emptyRouteIndex: RouteIndex = {
  byPath: new Map(),
  hintsByPath: new Map(),
  collectionNames: [],
  byCollectionPath: new Map(),
  countsByFilePath: new Map(),
}

function getCollectionPathKey(route: ComponentRoute): string | undefined {
  if (!route.collection) return undefined
  const parts = normalizePath(route.path).split('/').filter(Boolean)
  const collectionIndex = parts.indexOf(route.collection)
  if (collectionIndex < 0) return undefined
  return `/${parts.slice(collectionIndex).join('/')}`
}

/** Build all client route lookup structures in one cached pass. */
export function createRouteIndex(
  routes: readonly ComponentRoute[],
): RouteIndex {
  const byPath = new Map<string, ComponentRoute>()
  const hintsByPath = new Map<string, UrlRouteHint>()
  const byCollectionPath = new Map<string, ComponentRoute[]>()
  const countsByFilePath = new Map<string, number>()
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
    countsByFilePath.set(
      route.filePath,
      (countsByFilePath.get(route.filePath) || 0) + 1,
    )

    if (route.collection) {
      collectionNames.add(route.collection)
      const collectionPath = getCollectionPathKey(route)
      if (collectionPath) {
        const variants = byCollectionPath.get(collectionPath) || []
        variants.push(route)
        byCollectionPath.set(collectionPath, variants)
      }
    }
  }

  return {
    byPath,
    hintsByPath,
    byCollectionPath,
    countsByFilePath,
    collectionNames: [...collectionNames],
  }
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

  const index = useMemo<RouteIndex>(() => createRouteIndex(routes), [routes])

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
