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
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="px-2 py-3 mt-2 bg-soft rounded border-subtle border font-mono font-semibold text-body hover:scale-105 transition-transform active:scale-95 cursor-pointer"
      >
        Try again
      </button>
    </div>
  )
}

interface InternalErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

export function InternalErrorBoundary({
  children,
  fallback,
}: InternalErrorBoundaryProps) {
  return (
    <PrimitiveErrorBoundary
      fallback={fallback}
      FallbackComponent={!fallback ? InternalFallback : undefined}
    >
      {children}
    </PrimitiveErrorBoundary>
  )
}
