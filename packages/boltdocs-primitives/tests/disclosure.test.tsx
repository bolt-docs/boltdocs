import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
} from '../src/disclosure'

function Example({
  onOpenChange,
}: {
  onOpenChange?: (isOpen: boolean) => void
}) {
  return (
    <Disclosure onOpenChange={onOpenChange}>
      <DisclosureTrigger>Details</DisclosureTrigger>
      <DisclosurePanel>Body</DisclosurePanel>
    </Disclosure>
  )
}

describe('Disclosure', () => {
  it('starts closed and pairs the trigger with its panel', () => {
    render(<Example />)
    const trigger = screen.getByRole('button', { name: 'Details' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls')
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('opens on click and reports the new state', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<Example onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const panel = screen.getByRole('region')
    expect(panel).toHaveAttribute('aria-labelledby')
    expect(panel).toHaveTextContent('Body')
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('closes again on a second click', async () => {
    const user = userEvent.setup()
    render(<Example />)
    const trigger = screen.getByRole('button', { name: 'Details' })
    await user.click(trigger)
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('does not toggle when disabled', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Disclosure onOpenChange={onOpenChange}>
        <DisclosureTrigger disabled>Details</DisclosureTrigger>
        <DisclosurePanel>Body</DisclosurePanel>
      </Disclosure>,
    )
    await user.click(screen.getByRole('button', { name: 'Details' }))
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('clones a native button instead of nesting buttons', () => {
    render(
      <Disclosure>
        <DisclosureTrigger>
          <button type="button">Details</button>
        </DisclosureTrigger>
        <DisclosurePanel>Body</DisclosurePanel>
      </Disclosure>,
    )
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it('supports a controlled open state', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Disclosure isOpen={false} onOpenChange={onOpenChange}>
        <DisclosureTrigger>Details</DisclosureTrigger>
        <DisclosurePanel>Body</DisclosurePanel>
      </Disclosure>,
    )
    await user.click(screen.getByRole('button', { name: 'Details' }))
    // Controlled: the component asks, the caller decides.
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('region')).toBeNull()
  })
})
