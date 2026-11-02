import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  SubmenuTrigger,
} from '../src/menu'
import { Button } from '../src/button'

function BasicMenu(props: {
  onAction?: (k: string) => void
  onClose?: () => void
}) {
  return (
    <Menu
      aria-label="Actions"
      onAction={props.onAction}
      onClose={props.onClose}
      autoFocus={false}
    >
      <MenuItem data-key="open">Open</MenuItem>
      <MenuItem data-key="rename">Rename</MenuItem>
      <MenuItem data-key="delete" isDisabled>
        Delete
      </MenuItem>
      <MenuItem data-key="export">Export</MenuItem>
    </Menu>
  )
}

describe('Menu keyboard navigation', () => {
  it('exposes the menu and items with the right roles', () => {
    render(<BasicMenu />)
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(4)
  })

  it('marks a disabled item and skips it when arrowing', async () => {
    const user = userEvent.setup()
    render(<BasicMenu />)
    const menu = screen.getByRole('menu')

    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )

    menu.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus()
    // Delete is disabled, so it is skipped entirely.
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Export' })).toHaveFocus()
  })

  it('wraps from the last item back to the first', async () => {
    const user = userEvent.setup()
    render(<BasicMenu />)
    screen.getByRole('menu').focus()

    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Export' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
  })

  it('wraps backwards from the first item to the last', async () => {
    const user = userEvent.setup()
    render(<BasicMenu />)
    screen.getByRole('menu').focus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Export' })).toHaveFocus()
  })

  it('Home and End jump to the ends', async () => {
    const user = userEvent.setup()
    render(<BasicMenu />)
    screen.getByRole('menu').focus()

    await user.keyboard('{End}')
    expect(screen.getByRole('menuitem', { name: 'Export' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
  })

  it('activates with Enter and with Space', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(<BasicMenu onAction={onAction} />)

    screen.getByRole('menuitem', { name: 'Open' }).focus()
    await user.keyboard('{Enter}')
    expect(onAction).toHaveBeenCalledWith('open')

    screen.getByRole('menuitem', { name: 'Rename' }).focus()
    await user.keyboard(' ')
    expect(onAction).toHaveBeenCalledWith('rename')
  })

  it('does not activate a disabled item', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(<BasicMenu onAction={onAction} />)

    screen.getByRole('menuitem', { name: 'Delete' }).focus()
    await user.keyboard('{Enter}')
    expect(onAction).not.toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<BasicMenu onClose={onClose} />)

    screen.getByRole('menu').focus()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('jumps to an item by typing its first letter', async () => {
    const user = userEvent.setup()
    render(<BasicMenu />)
    screen.getByRole('menu').focus()

    await user.keyboard('r')
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus()
  })

  it('cycles through items sharing a first letter', async () => {
    const user = userEvent.setup()
    render(
      <Menu aria-label="Actions" autoFocus={false}>
        <MenuItem>Save</MenuItem>
        <MenuItem>Share</MenuItem>
        <MenuItem>Sign out</MenuItem>
      </Menu>,
    )
    screen.getByRole('menu').focus()

    await user.keyboard('s')
    expect(screen.getByRole('menuitem', { name: 'Save' })).toHaveFocus()
    await user.keyboard('s')
    expect(screen.getByRole('menuitem', { name: 'Share' })).toHaveFocus()
    await user.keyboard('s')
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus()
  })

  it('ignores typeahead when a modifier is held', async () => {
    const user = userEvent.setup()
    render(<BasicMenu />)
    screen.getByRole('menu').focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()

    // Ctrl+s must not be read as the letter "s".
    await user.keyboard('{Control>}s{/Control}')
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
  })

  it('keeps only the focused item in the tab order', async () => {
    const user = userEvent.setup()
    render(<BasicMenu />)
    const menu = screen.getByRole('menu')

    await user.click(document.body)
    menu.focus()
    await user.keyboard('{ArrowDown}')

    const open = screen.getByRole('menuitem', { name: 'Open' })
    const rename = screen.getByRole('menuitem', { name: 'Rename' })
    expect(open).toHaveAttribute('tabindex', '0')
    expect(rename).toHaveAttribute('tabindex', '-1')
  })
})

describe('Menu selection semantics', () => {
  it('does not announce a checked state when the menu cannot select', () => {
    render(<BasicMenu />)
    expect(screen.getByRole('menuitem', { name: 'Open' })).not.toHaveAttribute(
      'aria-checked',
    )
  })

  it('announces a checked state when the menu can select', () => {
    render(
      <Menu aria-label="Actions" selectionMode="multiple" autoFocus={false}>
        <MenuItem isSelected>Open</MenuItem>
        <MenuItem>Export</MenuItem>
      </Menu>,
    )
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Open' }),
    ).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Export' }),
    ).toHaveAttribute('aria-checked', 'false')
  })
})

describe('MenuSection', () => {
  it('labels the group with its heading', () => {
    render(
      <Menu aria-label="Actions" autoFocus={false}>
        <MenuSection title="Danger">
          <MenuItem>Delete</MenuItem>
        </MenuSection>
      </Menu>,
    )

    const group = screen.getByRole('group', { name: 'Danger' })
    expect(
      within(group).getByRole('menuitem', { name: 'Delete' }),
    ).toBeInTheDocument()
  })
})

describe('MenuTrigger', () => {
  function Harness() {
    return (
      <MenuTrigger triggerClassName="trigger">
        <span>Actions</span>
        <Menu aria-label="Actions" autoFocus={false}>
          <MenuItem data-key="one">One</MenuItem>
          <MenuItem data-key="two">Two</MenuItem>
          <MenuItem data-key="three">Three</MenuItem>
        </Menu>
      </MenuTrigger>
    )
  }

  it('describes itself as a menu button', () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Actions' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'true')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens on click and focuses the first item', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Actions' }))
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus()
  })

  it('opens on ArrowDown onto the first item', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus()
  })

  it('opens on ArrowUp onto the last item', async () => {
    // Lets a keyboard user reach the bottom without arrowing through the rest.
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Three' })).toHaveFocus()
  })

  it('arrows through the open menu from the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus()
  })
})

describe('SubmenuTrigger', () => {
  it('opens on ArrowRight and closes on ArrowLeft', async () => {
    const user = userEvent.setup()
    render(
      <Menu aria-label="Actions" autoFocus={false}>
        <SubmenuTrigger>
          <span>More</span>
          <Menu aria-label="More" autoFocus={false}>
            <MenuItem>Nested</MenuItem>
          </Menu>
        </SubmenuTrigger>
      </Menu>,
    )

    const trigger = screen.getByRole('menuitem', { name: 'More' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    trigger.focus()
    await user.keyboard('{ArrowRight}')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{ArrowLeft}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('does not pull a nested item into the parent arrow order', async () => {
    // The bug a DOM query would cause: ArrowDown from the last parent item
    // landing on an item inside the submenu.
    const user = userEvent.setup()
    render(
      <Menu aria-label="Actions" autoFocus={false}>
        <MenuItem>Alpha</MenuItem>
        <SubmenuTrigger>
          <span>More</span>
          <Menu aria-label="More" autoFocus={false}>
            <MenuItem>Nested</MenuItem>
          </Menu>
        </SubmenuTrigger>
      </Menu>,
    )

    const menu = screen.getByRole('menu', { name: 'Actions' })
    menu.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'More' })).toHaveFocus()
    // Wraps back to Alpha rather than reaching into the submenu.
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus()
  })
})

describe('Menu selection', () => {
  it('announces a checked state and toggles single selection', async () => {
    const onSelectionChange = vi.fn()
    const user = userEvent.setup()

    function H() {
      const [keys, setKeys] = useState<string[]>(['light'])
      return (
        <Menu
          aria-label="Theme"
          selectionMode="single"
          selectedKeys={keys}
          onSelectionChange={(next) => {
            onSelectionChange(next)
            setKeys(next)
          }}
          autoFocus={false}
        >
          <MenuItem data-key="light">Light</MenuItem>
          <MenuItem data-key="dark">Dark</MenuItem>
        </Menu>
      )
    }

    render(<H />)
    const light = screen.getByRole('menuitemradio', { name: 'Light' })
    const dark = screen.getByRole('menuitemradio', { name: 'Dark' })

    // The role is menuitemradio, not menuitem or a listbox option, and both
    // items carry aria-checked: on a radio group the unchecked ones say so.
    expect(light).toHaveAttribute('aria-checked', 'true')
    expect(dark).toHaveAttribute('aria-checked', 'false')
    expect(dark).not.toHaveAttribute('aria-selected')

    await user.click(dark)
    expect(onSelectionChange).toHaveBeenCalledWith(['dark'])
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('toggles items independently in multiple selection', async () => {
    const user = userEvent.setup()
    function H() {
      const [keys, setKeys] = useState<string[]>([])
      return (
        <Menu
          aria-label="Filters"
          selectionMode="multiple"
          selectedKeys={keys}
          onSelectionChange={setKeys}
          autoFocus={false}
        >
          <MenuItem data-key="a">A</MenuItem>
          <MenuItem data-key="b">B</MenuItem>
        </Menu>
      )
    }
    render(<H />)

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'A' }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'B' }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'A' }))

    expect(screen.getByRole('menuitemcheckbox', { name: 'A' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByRole('menuitemcheckbox', { name: 'B' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})

describe('MenuTrigger trigger element', () => {
  it('clones a button trigger instead of nesting one inside another', () => {
    // Found in the built docs HTML: the trigger was a <button> wrapping the
    // caller's <Button>, so there was one visible control with two tab stops
    // inside it and `aria-expanded` on the wrong element.
    render(
      <MenuTrigger>
        <Button aria-label="Selection theme">T</Button>
        <Menu aria-label="Theme" autoFocus={false}>
          <MenuItem data-key="light">Light</MenuItem>
        </Menu>
      </MenuTrigger>,
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false')
    expect(buttons[0]).toHaveAttribute('aria-haspopup', 'true')

    // The trigger is the caller's button, still carrying its own accessible name.
    expect(buttons[0]).toHaveAttribute('aria-label', 'Selection theme')
  })

  it('promotes a non-control trigger to a real button', () => {
    render(
      <MenuTrigger>
        <span>Actions</span>
        <Menu aria-label="Actions" autoFocus={false}>
          <MenuItem data-key="one">One</MenuItem>
        </Menu>
      </MenuTrigger>,
    )

    const trigger = screen.getByRole('button', { name: 'Actions' })
    expect(trigger.tagName).toBe('BUTTON')
  })

  it('points aria-controls at the element that holds the menu', () => {
    render(
      <MenuTrigger>
        <span>Actions</span>
        <Menu aria-label="Actions" autoFocus={false}>
          <MenuItem data-key="one">One</MenuItem>
        </Menu>
      </MenuTrigger>,
    )

    const trigger = screen.getByRole('button', { name: 'Actions' })
    const controlled = document.getElementById(
      trigger.getAttribute('aria-controls') as string,
    )
    expect(controlled).not.toBeNull()
    expect(controlled).not.toBe(trigger)
    expect(controlled?.querySelector('[role="menu"]')).not.toBeNull()
  })
})
