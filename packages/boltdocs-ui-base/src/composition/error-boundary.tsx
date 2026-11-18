import {
  ErrorBoundary as PrimitiveErrorBoundary,
  type ErrorBoundaryProps,
  type FallbackProps,
} from '@bdocs/primitives'
import { Button } from './button'
import { cn } from '../utils/cn'

export type { ErrorBoundaryProps, FallbackProps }

/**
 * The themed error boundary.
 *
 * Catching, reporting and reset live in `@bdocs/primitives`; this file only
 * supplies the default visual fallback and the `bdocs-error*` class names.
 */
export function ErrorBoundary({
  fallback,
  FallbackComponent,
  ...props
}: ErrorBoundaryProps) {
  const resolvedFallback =
    fallback ??
    (FallbackComponent
      ? undefined
      : (fallbackProps: FallbackProps) => (
          <ErrorBoundaryFallback {...fallbackProps} />
        ))

  return (
    <PrimitiveErrorBoundary
      {...props}
      fallback={resolvedFallback}
      FallbackComponent={FallbackComponent}
    >
      {props.children}
    </PrimitiveErrorBoundary>
  )
}

export interface ErrorBoundaryFallbackProps extends FallbackProps {
  className?: string
  titleClassName?: string
  messageClassName?: string
  buttonClassName?: string
}

export function ErrorBoundaryFallback({
  error,
  resetErrorBoundary,
  className,
  titleClassName,
  messageClassName,
  buttonClassName,
}: ErrorBoundaryFallbackProps) {
  return (
    <div className={cn('bdocs-error', className)}>
      <div className={cn('bdocs-error__title', titleClassName)}>
        Something went wrong
      </div>
      <p className={cn('bdocs-error__message', messageClassName)}>
        {error?.message ||
          'An unexpected error occurred while rendering this page.'}
      </p>
      <Button
        className={cn('bdocs-error__button', buttonClassName)}
        onPress={resetErrorBoundary}
      >
        Try again
      </Button>
    </div>
  )
}
