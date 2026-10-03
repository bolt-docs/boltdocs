import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Popover, Tooltip } from '../src/popover'

function Harness(props: {
  dismissable?: boolean
  shouldFocusOnOpen?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <a href="/page">Page</a>
      <Popover
        isOpen={open}
        onOpenChange={setOpen}
        isDismissable={props.dismissable}
        shouldFocusOnOpen={props.shouldFocusOnOpen}
      >
        <button>Inside one</button>
        <button>Inside two</button>
      </Popover>
    </>
  )
}

describe('Popover', () => {
  it('renders nothing while closed', () => {
    render(<Harness />)
    expect(document.querySelector('[data-bdocs-popover]')).toBeNull()
  })

  it('moves focus in on open by default', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('button', { name: 'Inside one' })).toHaveFocus()
  })

  it('leaves focus on the trigger when told not to focus', async () => {
    const user = userEvent.setup()
    render(<Harness shouldFocusOnOpen={false} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
  })

  it('closes on a press outside', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(document.querySelector('[data-bdocs-popover]')).not.toBeNull()

    await user.click(screen.getByRole('link', { name: 'Page' }))
    await waitFor(() =>
      expect(document.querySelector('[data-bdocs-popover]')).toBeNull(),
    )
  })

  it('ignores a press outside when not dismissable', async () => {
    const user = userEvent.setup()
    render(<Harness dismissable={false} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    await user.click(screen.getByRole('link', { name: 'Page' }))
    expect(document.querySelector('[data-bdocs-popover]')).not.toBeNull()
  })

  it('stays open when the press is inside it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'Inside two' }))
    expect(document.querySelector('[data-bdocs-popover]')).not.toBeNull()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open' })

    await user.click(trigger)
    await user.keyboard('{Escape}')

    await waitFor(() =>
      expect(document.querySelector('[data-bdocs-popover]')).toBeNull(),
    )
    expect(trigger).toHaveFocus()
  })

  it('calls onOpenChange(false) once per Escape', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <>
        <button onClick={() => {}}>Open</button>
        <Popover isOpen onOpenChange={onOpenChange}>
          <button>Inside</button>
        </Popover>
      </>,
    )
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onOpenChange).toHaveBeenCalledTimes(1)
  })
})

describe('Tooltip', () => {
  it('describes its trigger rather than replacing its name', async () => {
    // aria-label here would make the button announce the tooltip instead of
    // its own visible text.
    const user = userEvent.setup()
    render(
      <Tooltip content="Copies the URL" delay={0}>
        <button>Copy</button>
      </Tooltip>,
    )

    const trigger = screen.getByRole('button', { name: 'Copy' })
    expect(trigger).not.toHaveAttribute('aria-label')

    await user.hover(trigger)
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument())
    expect(trigger).toHaveAttribute(
      'aria-describedby',
      screen.getByRole('tooltip').id,
    )
  })

  it('appears on focus, not only on hover', async () => {
    // A tooltip reachable only by hover is invisible to a keyboard user.
    const user = userEvent.setup()
    render(
      <Tooltip content="Helpful text" delay={0}>
        <button>Info</button>
      </Tooltip>,
    )

    await user.tab()
    expect(screen.getByRole('button', { name: 'Info' })).toHaveFocus()
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument())
  })

  it('dismisses on Escape', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Helpful text" delay={0}>
        <button>Info</button>
      </Tooltip>,
    )

    await user.hover(screen.getByRole('button', { name: 'Info' }))
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument())

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  })
})
