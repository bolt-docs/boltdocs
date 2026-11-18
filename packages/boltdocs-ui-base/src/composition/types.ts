import type { ReactNode } from 'react'

export type ComponentBase = {
  className?: string
  children?: ReactNode
}

/**
 * Helper to type compound components (e.g. Navbar with Navbar.Link)
 */
export type CompoundComponent<P, S> = React.FC<P> & S
