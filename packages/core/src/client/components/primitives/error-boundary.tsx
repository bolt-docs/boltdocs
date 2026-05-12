import * as React from 'react'
import type { ErrorInfo, ComponentType, ReactNode } from 'react'
import { Component } from 'react'
import { Button } from './button'

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
}

export function ErrorBoundaryFallback({
  error,
  resetErrorBoundary,
}: ErrorBoundaryFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4 px-6 py-8 border border-subtle bg-surface rounded-2xl max-w-lg mx-auto shadow-xs">
      <div className="text-lg font-bold text-rose-600 dark:text-rose-400">
        Something went wrong
      </div>
      <p className="text-sm text-muted max-w-sm leading-relaxed">
        {error?.message ||
          'An unexpected error occurred while rendering this page.'}
      </p>
      <Button
        className="rounded-xl border border-subtle bg-main px-6 py-2.5 text-xs font-semibold text-body hover:bg-primary-50/50 hover:border-primary-500/50 transition-all duration-300 cursor-pointer outline-none select-none"
        onPress={resetErrorBoundary}
      >
        Try again
      </Button>
    </div>
  )
}
