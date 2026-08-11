import { createContext, use } from 'react'

// Hoisted to globalThis — see context.tsx for why
const g = typeof globalThis !== 'undefined' ? (globalThis as any) : {}

export const OutletContext =
  g.__BOLTDOCS_OUTLET_CONTEXT__ ||
  (g.__BOLTDOCS_OUTLET_CONTEXT__ = createContext<React.ReactNode>(null))

export const Outlet: React.FC = () => {
  const content = use(OutletContext)
  return <>{content}</>
}
