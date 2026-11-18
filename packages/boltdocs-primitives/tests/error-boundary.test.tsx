import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '../src/error-boundary'

function Boom({ message = 'boom' }: { message?: string }) {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  it('renders children while there is no error', () => {
    render(
      <ErrorBoundary fallback={<span>Fallback</span>}>
        <span>Content</span>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('catches a render error and renders a fallback node', () => {
    const onError = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary onError={onError} fallback={<span>Fallback</span>}>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Fallback')).toBeInTheDocument()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('passes the error and a working reset callback to a render-prop fallback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    function Harness() {
      const [shouldThrow, setShouldThrow] = useState(true)
      return (
        <ErrorBoundary
          fallback={({ error, resetErrorBoundary }) => (
            <button
              onClick={() => {
                setShouldThrow(false)
                resetErrorBoundary()
              }}
            >
              {error.message}
            </button>
          )}
        >
          {shouldThrow ? <Boom message="kaboom" /> : <span>Recovered</span>}
        </ErrorBoundary>
      )
    }

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'kaboom' }))
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })

  it('resets automatically when resetKeys change', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <ErrorBoundary resetKeys={['a']} fallback={<span>Fallback</span>}>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Fallback')).toBeInTheDocument()

    // A key change clears the error; the child must no longer throw.
    rerender(
      <ErrorBoundary resetKeys={['b']} fallback={<span>Fallback</span>}>
        <span>Recovered</span>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })
})
