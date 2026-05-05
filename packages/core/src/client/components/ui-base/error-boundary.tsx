import * as React from 'react'
import type { ErrorInfo } from 'react'
import { Component } from 'react'

import { Button } from '../primitives'

interface Props {
  children?: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Boltdocs Layout:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4 px-4">
            <div className="text-lg font-bold text-red-400">
              Something went wrong
            </div>
            <p className="text-sm text-muted max-w-md">
              {this.state.error?.message ||
                'An unexpected error occurred while rendering this page.'}
            </p>
            <Button
              className="rounded-lg border border-subtle bg-surface px-5 py-2 text-sm font-medium text-body transition-colors hover:bg-soft cursor-pointer"
              onPress={() => this.setState({ hasError: false })}
            >
              Try again
            </Button>
          </div>
        )
      )
    }

    return this.props.children
  }
}
