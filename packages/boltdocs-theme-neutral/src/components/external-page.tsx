import type { ReactNode } from 'react'

/**
 * The scroll container for a page outside the docs tree.
 *
 * External pages render at the root of the router, not inside `DocsLayout`, so
 * they do not inherit its content area. This is the element that gives them a
 * viewport to scroll in.
 */
export function ExternalPage({ children }: { children?: ReactNode }) {
  return (
    <main className="bdocs-external">
      {children}
    </main>
  )
}
