import { createContext, use } from 'react'
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

/**
 * Provider component for the documentation routes.
 */
export function RoutesProvider({
  routes,
  children,
}: {
  routes: ComponentRoute[]
  children: React.ReactNode
}) {
  return (
    <RoutesContext.Provider value={{ routes }}>
      {children}
    </RoutesContext.Provider>
  )
}
