import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FrameworkErrorBoundary } from '../src/app/error-boundary'

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('page exploded')
  return <span>Recovered</span>
}

describe('FrameworkErrorBoundary', () => {
  it('renders children until they throw', () => {
    render(
      <FrameworkErrorBoundary>
        <span>Page</span>
      </FrameworkErrorBoundary>,
    )
    expect(screen.getByText('Page')).toBeInTheDocument()
  })

  it('shows an alert with the message, stack and retry controls', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <FrameworkErrorBoundary>
        <Boom shouldThrow />
      </FrameworkErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('page exploded')).toBeInTheDocument()
    expect(screen.getByText('Stack trace')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reload page' }),
    ).toBeInTheDocument()
  })

  it('recovers when retry is pressed after the error is gone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    let broken = true

    function Flaky() {
      if (broken) throw new Error('once')
      return <span>Recovered</span>
    }

    render(
      <FrameworkErrorBoundary>
        <Flaky />
      </FrameworkErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    broken = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Recovered')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
