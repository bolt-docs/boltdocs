import { ErrorBoundary as PrimitiveErrorBoundary } from '../composition/error-boundary'
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
