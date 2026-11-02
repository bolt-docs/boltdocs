import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, ToggleButton } from '../src/button'

describe('Button', () => {
  it('defaults to type="button" so it cannot submit a form by accident', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('still allows an explicit submit', () => {
    render(<Button type="submit">Save</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('activates on click', async () => {
    const onPress = vi.fn()
    const user = userEvent.setup()
    render(<Button onPress={onPress}>Save</Button>)
    await user.click(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('activates on Enter and Space, like a native button', async () => {
    const onPress = vi.fn()
    const user = userEvent.setup()
    render(<Button onPress={onPress}>Save</Button>)
    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onPress).toHaveBeenCalledTimes(1)
    await user.keyboard(' ')
    expect(onPress).toHaveBeenCalledTimes(2)
  })

  it('is reachable by keyboard', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Button>First</Button>
        <Button>Second</Button>
      </>,
    )
    await user.tab()
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus()
  })

  it('a disabled button leaves the tab order and does not fire press', async () => {
    const onPress = vi.fn()
    const user = userEvent.setup()
    render(
      <>
        <Button isDisabled onPress={onPress}>
          Save
        </Button>
        <Button>Next</Button>
      </>,
    )
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    await user.tab()
    expect(button).not.toHaveFocus()
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus()
    await user.click(button)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('resolves className and children from render props', () => {
    render(
      <Button isDisabled className={(s) => (s.isDisabled ? 'off' : 'on')}>
        {(s) => (s.isDisabled ? 'Disabled' : 'Enabled')}
      </Button>,
    )
    expect(screen.getByRole('button')).toHaveClass('off')
    expect(screen.getByRole('button')).toHaveTextContent('Disabled')
  })

  it('does not leak library props onto the DOM element', () => {
    render(
      <Button isDisabled onPress={() => {}} data-testid="b">
        Save
      </Button>,
    )
    const button = screen.getByTestId('b')
    expect(button).not.toHaveAttribute('isDisabled')
    expect(button).not.toHaveAttribute('onPress')
    expect(button).toHaveAttribute('data-testid', 'b')
  })

  it('renders an anchor when href is set, and treats it as a button', () => {
    render(<Button href="/docs">Docs</Button>)
    const link = screen.getByRole('button', { name: 'Docs' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/docs')
  })

  it('an anchor button does not put disabled on the element', () => {
    render(
      <Button href="/docs" isDisabled>
        Docs
      </Button>,
    )
    const link = screen.getByRole('button', { name: 'Docs' })
    expect(link).not.toHaveAttribute('disabled')
    expect(link).toHaveAttribute('aria-disabled', 'true')
    expect(link).not.toHaveAttribute('href')
  })

  it('an anchor button activates on Enter, which a plain link would not', async () => {
    const onPress = vi.fn()
    const user = userEvent.setup()
    render(
      <Button href="/docs" onPress={onPress}>
        Docs
      </Button>,
    )
    await user.tab()
    await user.keyboard('{Enter}')
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('ToggleButton', () => {
  it('exposes aria-pressed rather than aria-selected', () => {
    const { rerender } = render(<ToggleButton>Bold</ToggleButton>)
    const button = screen.getByRole('button', { name: 'Bold' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).not.toHaveAttribute('aria-selected')
    rerender(<ToggleButton isSelected>Bold</ToggleButton>)
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('stays in the tab order and activates with Space', async () => {
    const onPress = vi.fn()
    const user = userEvent.setup()
    render(
      <ToggleButton isSelected onPress={onPress}>
        Bold
      </ToggleButton>,
    )
    await user.tab()
    const button = screen.getByRole('button', { name: 'Bold' })
    expect(button).toHaveFocus()
    await user.keyboard(' ')
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('ToggleButton handlers', () => {
  it('fires both onPress and onChange', async () => {
    const onPress = vi.fn()
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ToggleButton
        isSelected={false}
        onPress={onPress}
        onChange={onChange}
        aria-label="Theme"
      >
        T
      </ToggleButton>,
    )

    await user.click(screen.getByRole('button', { name: 'Theme' }))

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('reports the value to move to, so the caller owns the state', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    // Uncontrolled on purpose: the point is that the button never flips itself.
    render(
      <ToggleButton isSelected onChange={onChange} aria-label="Theme">
        T
      </ToggleButton>,
    )

    await user.click(screen.getByRole('button', { name: 'Theme' }))

    expect(onChange).toHaveBeenCalledWith(false)
    expect(screen.getByRole('button', { name: 'Theme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
