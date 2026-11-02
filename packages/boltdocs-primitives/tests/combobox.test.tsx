import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Autocomplete, Input, SearchField } from '../src/combobox'
import { ListBox, ListBoxItem } from '../src/collection'

describe('Input', () => {
  it('reports the value, not the event', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Input aria-label="Name" onChange={onChange} />)

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'ab')
    expect(onChange).toHaveBeenLastCalledWith('ab')
  })

  it('works uncontrolled', async () => {
    const user = userEvent.setup()
    render(<Input aria-label="Name" />)
    const input = screen.getByRole('textbox', { name: 'Name' })
    await user.type(input, 'hi')
    expect(input).toHaveValue('hi')
  })
})

describe('SearchField', () => {
  it('is a searchbox and submits on Enter', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<SearchField aria-label="Search" onSubmit={onSubmit} />)

    const input = screen.getByRole('searchbox', { name: 'Search' })
    await user.type(input, 'shiki{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('shiki')
  })

  it('shows the clear button only when there is something to clear', async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()
    render(<SearchField aria-label="Search" onClear={onClear} />)

    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'a')

    const clear = screen.getByRole('button', { name: 'Clear search' })
    await user.click(clear)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('announces the result count politely', () => {
    render(
      <SearchField
        aria-label="Search"
        resultCount={7}
        resultMessage={(n) => `${n} results`}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('7 results')
  })
})

describe('Autocomplete', () => {
  function Harness() {
    const [value, setValue] = useState('')
    const [open, setOpen] = useState(false)
    return (
      <Autocomplete
        aria-label="Search docs"
        value={value}
        onChange={setValue}
        isOpen={open}
        onOpenChange={setOpen}
        listBoxId="results"
        activeDescendantId={open ? 'opt-1' : undefined}
      >
        {({ isOpen }) =>
          isOpen ? (
            <ListBox id="results" activeIndex={0}>
              <ListBoxItem id="opt-1" data-key="a">
                Alpha
              </ListBoxItem>
              <ListBoxItem id="opt-2" data-key="b">
                Beta
              </ListBoxItem>
            </ListBox>
          ) : null
        }
      </Autocomplete>
    )
  }

  it('is a combobox wired to the listbox and the active option', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Search docs' })

    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).toHaveAttribute('aria-controls', 'results')
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
  })

  it('keeps DOM focus in the input while a descendant is active', async () => {
    // Moving real focus into the list would lose the typed text.
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Search docs' })

    await user.click(input)
    await user.type(input, 'al')
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('aria-activedescendant', 'opt-1')
    expect(input).toHaveValue('al')
  })

  it('opens on focus so the options are reachable', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Search docs' })

    expect(input).toHaveAttribute('aria-expanded', 'false')
    await user.click(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('reopens the list when the user types after closing it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Search docs' })

    await user.click(input)
    await user.keyboard('{Escape}')
    expect(input).toHaveAttribute('aria-expanded', 'false')

    await user.type(input, 'x')
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes on Escape without clearing what was typed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Search docs' })

    await user.type(input, 'ab')
    await user.keyboard('{Escape}')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).toHaveValue('ab')
  })
})

describe('ListBox selection', () => {
  it('marks single selection with aria-selected', () => {
    render(
      <ListBox selectionMode="single" selectedKeys={['a']} activeIndex={0}>
        <ListBoxItem data-key="a">Alpha</ListBoxItem>
        <ListBoxItem data-key="b">Beta</ListBoxItem>
      </ListBox>,
    )
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('option', { name: 'Beta' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('does not claim selection semantics when it cannot select', () => {
    render(
      <ListBox>
        <ListBoxItem data-key="a">Alpha</ListBoxItem>
      </ListBox>,
    )
    expect(screen.getByRole('option', { name: 'Alpha' })).not.toHaveAttribute(
      'aria-selected',
    )
  })

  it('reports multiselectable when it is', () => {
    render(
      <ListBox selectionMode="multiple">
        <ListBoxItem data-key="a">Alpha</ListBoxItem>
      </ListBox>,
    )
    expect(screen.getByRole('listbox')).toHaveAttribute(
      'aria-multiselectable',
      'true',
    )
  })

  it('toggles an option in multiple selection', async () => {
    const user = userEvent.setup()
    function H() {
      const [keys, setKeys] = useState<string[]>([])
      return (
        <ListBox
          selectionMode="multiple"
          selectedKeys={keys}
          onSelectionChange={setKeys}
        >
          <ListBoxItem data-key="a">Alpha</ListBoxItem>
          <ListBoxItem data-key="b">Beta</ListBoxItem>
        </ListBox>
      )
    }
    render(<H />)

    await user.click(screen.getByRole('option', { name: 'Alpha' }))
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await user.click(screen.getByRole('option', { name: 'Beta' }))
    await user.click(screen.getByRole('option', { name: 'Alpha' }))
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })
})

describe('ListBox action without selection', () => {
  it('activates an option even with no selection mode', async () => {
    // This is the search-results shape: nothing is selected, clicking navigates.
    // An earlier version returned early when selectionMode was 'none', so the
    // list rendered and was reachable but did nothing.
    const onAction = vi.fn()
    const user = userEvent.setup()

    render(
      <ListBox onAction={onAction}>
        <ListBoxItem data-key="intro">Intro</ListBoxItem>
        <ListBoxItem data-key="api">API</ListBoxItem>
      </ListBox>,
    )

    await user.click(screen.getByRole('option', { name: 'API' }))
    expect(onAction).toHaveBeenCalledWith('api')
    expect(screen.getByRole('option', { name: 'API' })).not.toHaveAttribute(
      'aria-selected',
    )
  })

  it('reports an empty list only when it knows the options', () => {
    const { rerender } = render(
      <ListBox items={[] as string[]}>{() => null}</ListBox>,
    )
    expect(screen.getByRole('listbox')).toHaveAttribute('data-empty', 'true')

    // With no `items` the length is unknown; claiming emptiness would be a guess.
    rerender(<ListBox>{() => null}</ListBox>)
    expect(screen.getByRole('listbox')).not.toHaveAttribute('data-empty')
  })

  it('renders the render-prop children once per item', () => {
    render(
      <ListBox items={['a', 'b', 'c'] as string[]}>
        {(item) => <ListBoxItem data-key={item}>{item}</ListBoxItem>}
      </ListBox>,
    )
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })
})
