import type { ErrorInfo, ComponentType, ReactNode } from 'react'
import { Component } from 'react'
import { Button } from './button'
import { cn } from '../../utils/cn'

export interface FallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export interface ErrorBoundaryProps {
  children?: ReactNode
  fallback?: ReactNode
  FallbackComponent?: ComponentType<FallbackProps>
  onError?: (error: Error, info: ErrorInfo) => void
  onReset?: () => void
  /**
   * When any of these values change, a caught error is automatically
   * reset (e.g. pass the current route path so navigation clears stale
   * render errors).
   */
  resetKeys?: unknown[]
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { hasError: false, error: null }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    } else {
      console.error(
        'ErrorBoundary caught an unhandled error:',
        error,
        errorInfo,
      )
    }
  }

  public resetErrorBoundary = () => {
    if (this.props.onReset) {
      this.props.onReset()
    }
    this.setState({ hasError: false, error: null })
  }

  private prevResetKeys: unknown[] = []

  public componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (
      prevProps.resetKeys !== this.props.resetKeys &&
      this.state.hasError &&
      this.props.resetKeys?.length &&
      this.props.resetKeys.some(
        (key, i) => !Object.is(key, this.prevResetKeys[i]),
      )
    ) {
      this.prevResetKeys = this.props.resetKeys
      this.resetErrorBoundary()
      return
    }
    this.prevResetKeys = this.props.resetKeys ?? []
  }

  public render() {
    const { hasError, error } = this.state
    const { children, fallback, FallbackComponent } = this.props

    if (hasError && error) {
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={error}
            resetErrorBoundary={this.resetErrorBoundary}
          />
        )
      }
      if (fallback) {
        return fallback
      }
      return (
        <ErrorBoundaryFallback
          error={error}
          resetErrorBoundary={this.resetErrorBoundary}
        />
      )
    }

    return children
  }
}

export interface ErrorBoundaryFallbackProps {
  error: Error
  resetErrorBoundary: () => void
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
