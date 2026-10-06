import {
  ErrorBoundary as PrimitiveErrorBoundary,
  type FallbackProps,
} from '../composition/error-boundary'
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

function InternalFallback({
  error,
  resetErrorBoundary,
  className,
}: FallbackProps & { className?: string }) {
  return (
    <div role="alert" className={cn('bdocs-error-debug', className)}>
      <p className="bdocs-error-debug__title">Something went wrong</p>
      {error?.message && (
        <pre className="bdocs-error-debug__message">{error.message}</pre>
      )}
      {error?.stack && (
        <details className="bdocs-error-debug__details">
          <summary className="bdocs-error-debug__summary">
            Error details
          </summary>
          <pre className="bdocs-error-debug__stack">{error.stack}</pre>
        </details>
      )}
      <div className="bdocs-error-debug__actions">
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="bdocs-error-debug__button"
        >
          Try again
        </button>
        {typeof window !== 'undefined' && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bdocs-error-debug__button bdocs-error-debug__button--ghost"
          >
            Reload page
          </button>
        )}
      </div>
    </div>
  )
}

interface InternalErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  /**
   * When any of these values change, a caught error is automatically
   * reset (the shell passes the current route path so navigation
   * clears stale render errors).
   */
  resetKeys?: unknown[]
}

export function InternalErrorBoundary({
  children,
  fallback,
  resetKeys,
}: InternalErrorBoundaryProps) {
  return (
    <PrimitiveErrorBoundary
      fallback={fallback}
      resetKeys={resetKeys}
      FallbackComponent={!fallback ? InternalFallback : undefined}
    >
      {children}
    </PrimitiveErrorBoundary>
  )
}
