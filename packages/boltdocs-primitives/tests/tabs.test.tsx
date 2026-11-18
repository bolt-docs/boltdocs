import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tab, TabList, TabPanel, Tabs } from '../src/tabs'

function Example({
  onSelectionChange,
  activationMode,
}: {
  onSelectionChange?: (key: string) => void
  activationMode?: 'automatic' | 'manual'
}) {
  return (
    <Tabs
      defaultSelectedKey="one"
      onSelectionChange={onSelectionChange}
      activationMode={activationMode}
    >
      <TabList aria-label="Sections">
        <Tab id="one">One</Tab>
        <Tab id="two">Two</Tab>
        <Tab id="three" isDisabled>
          Three
        </Tab>
      </TabList>
      <TabPanel tabId="one">Panel one</TabPanel>
      <TabPanel tabId="two">Panel two</TabPanel>
      <TabPanel tabId="three">Panel three</TabPanel>
    </Tabs>
  )
}

describe('Tabs', () => {
  it('wires each tab to its panel with aria-controls and aria-labelledby', () => {
    render(<Example />)
    const one = screen.getByRole('tab', { name: 'One' })
    const panel = screen.getByRole('tabpanel', { name: 'One' })
    expect(one).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveAttribute('aria-labelledby', one.id)
    expect(one).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps only the selected tab in the tab order', () => {
    render(<Example />)
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute(
      'tabindex',
      '0',
    )
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute(
      'tabindex',
      '-1',
    )
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute(
      'tabindex',
      '-1',
    )
  })

  it('moves focus and selection with the arrow keys and skips disabled tabs', async () => {
    const onSelectionChange = vi.fn()
    const user = userEvent.setup()
    render(<Example onSelectionChange={onSelectionChange} />)
    screen.getByRole('tab', { name: 'One' }).focus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus()
    expect(onSelectionChange).toHaveBeenCalledWith('two')

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus()
    expect(onSelectionChange).toHaveBeenCalledWith('one')
  })

  it('wraps with Home and End', async () => {
    const user = userEvent.setup()
    render(<Example />)
    screen.getByRole('tab', { name: 'One' }).focus()
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus()
  })

  it('supports manual activation', async () => {
    const onSelectionChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Example activationMode="manual" onSelectionChange={onSelectionChange} />,
    )
    screen.getByRole('tab', { name: 'One' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus()
    // Focusing alone must not commit in manual mode.
    expect(onSelectionChange).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(onSelectionChange).toHaveBeenCalledWith('two')
  })

  it('hides panels that are not selected', () => {
    render(<Example />)
    expect(screen.getByRole('tabpanel', { name: 'One' })).not.toHaveAttribute(
      'hidden',
    )
    expect(screen.getByText('Panel two')).toHaveAttribute('hidden')
  })

  it('exposes vertical orientation', () => {
    render(
      <Tabs defaultSelectedKey="one" orientation="vertical">
        <TabList>
          <Tab id="one">One</Tab>
          <Tab id="two">Two</Tab>
        </TabList>
      </Tabs>,
    )
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-orientation',
      'vertical',
    )
  })

  it('can render a navigation row with no tablist role', () => {
    render(
      <Tabs defaultSelectedKey="one">
        <TabList role="none" aria-label="Sections">
          <Tab id="one" href="/one">
            One
          </Tab>
        </TabList>
      </Tabs>,
    )
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute(
      'href',
      '/one',
    )
  })

  it('supports render-prop children on a tab', () => {
    render(
      <Tabs defaultSelectedKey="one">
        <TabList>
          <Tab id="one">
            {({ isSelected }) => <span data-selected={isSelected}>One</span>}
          </Tab>
        </TabList>
      </Tabs>,
    )
    expect(within(screen.getByRole('tab')).getByText('One')).toHaveAttribute(
      'data-selected',
      'true',
    )
  })
})
