import { createContext, use } from 'react'

// Hoisted to globalThis — see context.tsx for why. When the module is
// evaluated twice (bundle splits between boltdocs/client and
// boltdocs/primitives), both evaluations must share one context instance.
const g: Record<PropertyKey, unknown> =
  typeof globalThis !== 'undefined' ? globalThis : {}

const existingOutletContext = g.__BOLTDOCS_OUTLET_CONTEXT__ as
  | React.Context<React.ReactNode>
  | undefined

export const OutletContext =
  existingOutletContext ?? createContext<React.ReactNode>(null)

if (!existingOutletContext) {
  g.__BOLTDOCS_OUTLET_CONTEXT__ = OutletContext
}

export const Outlet: React.FC = () => {
  const content = use(OutletContext)
  return <>{content}</>
}
