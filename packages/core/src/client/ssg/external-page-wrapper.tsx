import type { ReactNode } from 'react'

export function ExternalPageWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="boltdocs-external-content h-screen overflow-y-auto">
      {children}
    </div>
  )
}
