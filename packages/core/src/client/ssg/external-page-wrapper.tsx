import type { ReactNode } from 'react'

export function ExternalPageWrapper({ children }: { children: ReactNode }) {
  return (
    <main className="boltdocs-external-content h-screen overflow-y-auto">
      {children}
    </main>
  )
}
