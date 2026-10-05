import { ErrorBoundary as PrimitiveErrorBoundary } from '../primitives/error-boundary'
import type { ReactNode } from 'react'

interface ErrorBoundaryProps {
  children?: ReactNode
  fallback?: ReactNode
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  return (
    <PrimitiveErrorBoundary fallback={fallback}>
      {children}
    </PrimitiveErrorBoundary>
  )
}
