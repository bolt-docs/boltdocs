import { createContext, use, useEffect, useState } from 'react'
import type { ComponentRoute } from '../types'

interface RoutesContextType {
  routes: ComponentRoute[]
}

const RoutesContext = createContext<RoutesContextType>({
  routes: [],
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
    <RoutesContext.Provider value={{ routes }}>
      {children}
    </RoutesContext.Provider>
  )
}
