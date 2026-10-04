import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal, ModalOverlay } from '../src/modal'
import { Dialog } from '../src/dialog'

/** A dialog with focusable content at both ends plus something in between. */
function Harness({ dismissable = true }: { dismissable?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open</button>
      <a href="/before" data-testid="before">
        Before
      </a>

      <ModalOverlay
        isOpen={open}
        isDismissable={dismissable}
        onOpenChange={setOpen}
      >
        <Modal isOpen={open}>
          <Dialog isOpen={open} aria-label="Settings">
            <button>First</button>
            <input aria-label="Middle" />
            <button>Last</button>
            <button onClick={() => setOpen(false)}>Close</button>
          </Dialog>
        </Modal>
      </ModalOverlay>

      <a href="/after" data-testid="after">
        After
      </a>
    </div>
  )
}

describe('ModalOverlay focus management', () => {
  it('moves focus into the dialog on open', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('keeps Tab inside the dialog and wraps at the end', async () => {
    // The wrap is the part that is usually missing: a trap that only blocks
    // focus from leaving leaves a keyboard user with no way onward.
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Middle' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    // Past the last element, focus wraps to the first rather than escaping.
    await user.tab()
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('wraps backwards with Shift+Tab', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
  })

  it('never lets focus reach the page behind', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    for (let i = 0; i < 10; i++) await user.tab()

    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'Open' })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('dialog', { hidden: true }),
    ).not.toBeInTheDocument()
    // Returning focus is what keeps a keyboard user from being dropped at the
    // top of the document.
    expect(trigger).toHaveFocus()
  })

  it('marks the page behind as aria-hidden while open', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    // Asserted on the attribute rather than through getByRole: a role query
    // deliberately skips aria-hidden subtrees, so it would report "not found"
    // for exactly the elements this test is about.
    expect(
      screen.getByTestId('before').closest('[aria-hidden="true"]'),
    ).not.toBeNull()
    expect(
      screen.getByTestId('after').closest('[aria-hidden="true"]'),
    ).not.toBeNull()
  })

  it('restores aria-hidden and scroll on close', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const before = screen.getByRole('link', { name: 'Before', hidden: true })

    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(before.closest('[aria-hidden="true"]')).not.toBeNull()

    await user.keyboard('{Escape}')
    expect(before.closest('[aria-hidden="true"]')).toBeNull()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('locks scrolling while open', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    const overlay = document.querySelector('[data-bdocs-modal-overlay]')
    if (!overlay) throw new Error('The modal overlay was not rendered')
    await user.click(overlay)
    expect(
      screen.queryByRole('dialog', { hidden: true }),
    ).not.toBeInTheDocument()
  })

  it('ignores a backdrop click when not dismissable', async () => {
    const user = userEvent.setup()
    render(<Harness dismissable={false} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    const overlay = document.querySelector('[data-bdocs-modal-overlay]')
    if (!overlay) throw new Error('The modal overlay was not rendered')
    await user.click(overlay)
    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument()
  })

  it('a click inside the dialog does not close it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    await user.click(screen.getByRole('button', { name: 'Last' }))
    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument()
  })

  it('calls onOpenChange(false) exactly once per Escape', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ModalOverlay isOpen onOpenChange={onOpenChange}>
        <Modal isOpen>
          <Dialog isOpen aria-label="Settings">
            <button>Only</button>
          </Dialog>
        </Modal>
      </ModalOverlay>,
    )

    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onOpenChange).toHaveBeenCalledTimes(1)
  })

  it('exposes the dialog with a modal role and no label lost', () => {
    render(
      <ModalOverlay isOpen>
        <Modal isOpen>
          <Dialog isOpen aria-label="Settings">
            <button>Only</button>
          </Dialog>
        </Modal>
      </ModalOverlay>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('tabindex', '-1')
  })
})

describe('Dialog initial focus', () => {
  it('skips a hidden input that its selector used to match', () => {
    // The selector this component carried inline did not exclude
    // `input[type="hidden"]`, so focus landed on a control no user can reach.
    render(
      <Dialog aria-label="Settings">
        <input type="hidden" data-testid="trap" />
        <button>Real first control</button>
      </Dialog>,
    )

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Real first control' }),
    )
  })

  it('focuses a contenteditable first control', () => {
    // The inline selector also did not match `[contenteditable]`, so this was
    // skipped and the dialog fell through to focusing itself.
    render(
      <Dialog aria-label="Editor">
        <div contentEditable suppressContentEditableWarning>
          Edit me
        </div>
        <button>Later</button>
      </Dialog>,
    )

    expect(document.activeElement).toBe(screen.getByText('Edit me'))
  })

  it('falls back to the dialog itself when there is nothing to focus', () => {
    render(
      <Dialog aria-label="Empty">
        <p>Nothing focusable here.</p>
      </Dialog>,
    )

    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })
})
