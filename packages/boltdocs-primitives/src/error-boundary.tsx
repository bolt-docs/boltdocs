import * as React from 'react'

/**
 * The error-boundary mechanics, with no appearance of their own.
 *
 * React requires a class for `getDerivedStateFromError`, so this is one. The
 * fallback is a render prop: the caller decides what an error looks like, which
 * keeps the primitive style-neutral while the catch/reset contract stays in a
 * single, testable place.
 */

export interface FallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export interface ErrorBoundaryProps {
  children?: React.ReactNode
  fallback?: React.ReactNode | ((props: FallbackProps) => React.ReactNode)
  FallbackComponent?: React.ComponentType<FallbackProps>
  onError?: (error: Error, info: React.ErrorInfo) => void
  onReset?: () => void
  /** Changing any of these values clears a caught error. */
  resetKeys?: unknown[]
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, info)
    } else {
      console.error('ErrorBoundary caught an unhandled error:', error, info)
    }
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.()
    this.setState({ error: null })
  }

  static displayName = 'ErrorBoundary'

  private prevResetKeys: unknown[] = []

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const keys = this.props.resetKeys
    if (
      this.state.error &&
      prevProps.resetKeys !== keys &&
      keys?.length &&
      keys.some((key, i) => !Object.is(key, this.prevResetKeys[i]))
    ) {
      this.prevResetKeys = keys
      this.resetErrorBoundary()
      return
    }
    this.prevResetKeys = keys ?? []
  }

  render(): React.ReactNode {
    const { error } = this.state
    const { children, fallback, FallbackComponent } = this.props
    if (!error) return children

    const props: FallbackProps = {
      error,
      resetErrorBoundary: this.resetErrorBoundary,
    }
    if (FallbackComponent) return <FallbackComponent {...props} />
    if (typeof fallback === 'function') return fallback(props)
    return fallback ?? null
  }
}
