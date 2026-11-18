import type * as React from 'react'
import { Button, ErrorBoundary } from '@bdocs/primitives'

/**
 * The framework-level error screen the shell falls back to when a theme does
 * not supply its own `ErrorBoundary` slot.
 *
 * This is a diagnostic, not themed appearance: it uses system colors and
 * inline styles so it stays readable even when the failure happened before the
 * theme stylesheet loaded. The catch/reset mechanics come from
 * `@bdocs/primitives`; no theme CSS is involved.
 */

const panel: React.CSSProperties = {
  boxSizing: 'border-box',
  position: 'fixed',
  inset: 0,
  zIndex: 2147483647,
  overflow: 'auto',
  padding: '2rem',
  background: 'Canvas',
  color: 'CanvasText',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '0.875rem',
  lineHeight: 1.6,
}

const title: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1.25rem',
}

const message: React.CSSProperties = { margin: '0 0 1rem' }

const details: React.CSSProperties = {
  margin: '0 0 1rem',
  border: '1px solid CanvasText',
  borderRadius: 4,
  padding: '0.5rem 0.75rem',
}

const stack: React.CSSProperties = {
  margin: '0.5rem 0 0',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
}

const actions: React.CSSProperties = { display: 'flex', gap: '0.5rem' }

const button: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  border: '1px solid CanvasText',
  borderRadius: 4,
  background: 'CanvasText',
  color: 'Canvas',
  cursor: 'pointer',
  font: 'inherit',
}

const ghostButton: React.CSSProperties = {
  ...button,
  background: 'Canvas',
  color: 'CanvasText',
}

export function FrameworkErrorBoundary({
  children,
}: {
  children?: React.ReactNode
}): React.ReactElement {
  return (
    <ErrorBoundary
      fallback={({ error, resetErrorBoundary }) => (
        <div role="alert" style={panel}>
          <h1 style={title}>Something went wrong</h1>
          <p style={message}>{error.message}</p>
          {error.stack && (
            <details style={details}>
              <summary>Stack trace</summary>
              <pre style={stack}>{error.stack}</pre>
            </details>
          )}
          <div style={actions}>
            <Button onPress={resetErrorBoundary} style={button}>
              Try again
            </Button>
            {typeof window !== 'undefined' && (
              <Button
                onPress={() => window.location.reload()}
                style={ghostButton}
              >
                Reload page
              </Button>
            )}
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

FrameworkErrorBoundary.displayName = 'FrameworkErrorBoundary'
