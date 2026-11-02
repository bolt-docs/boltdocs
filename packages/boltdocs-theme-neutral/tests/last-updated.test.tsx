import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { registerSiteBridge, resetSiteBridge } from '@bdocs/runtime'
import { LastUpdated } from '../src/components/mdx/last-updated'

describe('LastUpdated', () => {
  it('renders the deterministic date', () => {
    render(<LastUpdated date="2026-01-15T10:00:00.000Z" />)
    expect(screen.getByText(/Last updated on/)).toBeTruthy()
    expect(screen.getByText(/January 15, 2026/)).toBeTruthy()
  })

  it('renders nothing without a date or a plugin slot', () => {
    const { container } = render(<LastUpdated />)
    expect(container.firstChild).toBeNull()
  })

  it('ignores an invalid date', () => {
    const { container } = render(<LastUpdated date="not-a-date" />)
    expect(container.firstChild).toBeNull()
  })

  it('merges custom classes into the footer', () => {
    const { container } = render(
      <LastUpdated date="2026-01-15T10:00:00.000Z" className="my-footer" />,
    )
    expect(container.querySelector('.my-footer')?.textContent).toContain(
      'Last updated on',
    )
  })
})

describe('LastUpdated plugin slot', () => {
  afterEach(() => {
    resetSiteBridge()
  })

  function registerFooter() {
    registerSiteBridge({
      clientSlots: {
        'page:footer:start': [
          {
            id: 'page:footer:start:0',
            Component: () => <span>Jesús Alcalá</span>,
          },
        ],
      },
    })
  }

  it('renders the footer slot next to the date', () => {
    registerFooter()
    const { container } = render(
      <LastUpdated date="2026-01-15T10:00:00.000Z" />,
    )
    expect(
      container.querySelector('.bdocs-last-updated')?.textContent,
    ).toContain('Jesús Alcalá')
    expect(screen.getByText(/Last updated on/)).toBeTruthy()
  })

  it('renders the footer slot when the route carries no date', () => {
    registerFooter()
    render(<LastUpdated />)
    expect(screen.getByText('Jesús Alcalá')).toBeTruthy()
  })
})
