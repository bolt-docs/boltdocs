import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { registerSiteBridge, resetSiteBridge } from '../src/site-bridge'
import { FloatingSlots, PluginSlot } from '../src/slot-host'

afterEach(() => resetSiteBridge())

describe('slot host', () => {
  it('renders eager components registered for a named slot', () => {
    registerSiteBridge({
      clientSlots: {
        'header:right': [
          { id: 'a', Component: () => <span>First</span> },
          { id: 'b', Component: () => <span>Second</span> },
        ],
      },
    })

    render(<PluginSlot name="header:right" />)
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('ignores entries without a component and unknown slots', () => {
    registerSiteBridge({
      clientSlots: {
        'header:right': [
          { id: 'lazy', load: () => Promise.resolve({ default: () => null }) },
        ],
      },
    })

    const { container } = render(<PluginSlot name="header:right" />)
    expect(container).toBeEmptyDOMElement()
    expect(
      render(<PluginSlot name="unknown" />).container,
    ).toBeEmptyDOMElement()
  })

  it('mounts lazy floating slots inside Suspense', async () => {
    registerSiteBridge({
      clientSlots: {
        'floating:after': [
          {
            id: 'bubble',
            load: () =>
              Promise.resolve({
                default: () => <span>Bubble</span>,
              }),
          },
        ],
      },
    })

    render(<FloatingSlots />)
    expect(await screen.findByText('Bubble')).toBeInTheDocument()
  })

  it('does nothing when there is no bridge registration', () => {
    const { container } = render(<FloatingSlots />)
    expect(container).toBeEmptyDOMElement()
  })
})
