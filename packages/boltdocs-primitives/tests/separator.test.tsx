import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Separator } from '../src/separator'

describe('Separator', () => {
  it('renders a horizontal rule by default', () => {
    const { container } = render(<Separator />)
    expect(container.querySelector('hr')).toBeInTheDocument()
    expect(container.querySelector('hr')).toHaveAttribute(
      'aria-orientation',
      'horizontal',
    )
  })

  it('renders a vertical separator with an explicit role', () => {
    render(<Separator orientation="vertical" aria-label="Sections" />)
    const separator = screen.getByRole('separator', { orientation: 'vertical' })
    expect(separator.tagName).toBe('DIV')
    expect(separator).toHaveAttribute('aria-label', 'Sections')
  })

  it('resolves a render-prop className from its orientation', () => {
    const { container } = render(
      <Separator
        orientation="vertical"
        className={({ orientation }) => `sep--${orientation}`}
      />,
    )
    expect(container.firstChild).toHaveClass('sep--vertical')
  })
})
