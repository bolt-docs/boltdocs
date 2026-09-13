import {
  ErrorBoundary as PrimitiveErrorBoundary,
  type FallbackProps,
} from '../primitives/error-boundary'
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

function InternalFallback({
  error,
  resetErrorBoundary,
  className,
}: FallbackProps & { className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'p-2 font-mono flex flex-col items-center justify-between min-h-[30vh]',
        className,
      )}
    >
      <p className="text-lg font-semibold text-danger-500">
        Something went wrong
      </p>
      {error?.message && (
        <pre className="text-sm mt-2 max-w-md overflow-auto whitespace-pre-wrap break-word">
          {error.message}
        </pre>
      )}
      {error?.stack && (
        <details className="mt-2 max-w-md text-left text-xs">
          <summary className="cursor-pointer text-muted select-none outline-none">
            Error details
          </summary>
          <pre className="mt-2 p-2 bg-soft rounded border-subtle border overflow-auto max-h-48 whitespace-pre-wrap break-words">
            {error.stack}
          </pre>
        </details>
      )}
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="px-2 py-3 bg-soft rounded border-subtle border font-mono font-semibold text-body hover:scale-105 transition-transform active:scale-95 cursor-pointer"
        >
          Try again
        </button>
        {typeof window !== 'undefined' && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-2 py-3 rounded font-mono font-semibold text-muted hover:text-body transition-colors cursor-pointer"
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
