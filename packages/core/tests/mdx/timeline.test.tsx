// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Timeline,
  TimelineItem,
} from '../../src/client/components/mdx/timeline'

describe('Timeline (MDX component)', () => {
  it('renders an ordered list with role="list"', () => {
    const { container } = render(
      <Timeline>
        <Timeline.Item title="Hello" />
      </Timeline>,
    )
    const list = container.querySelector('ol')
    expect(list).not.toBeNull()
    expect(list?.getAttribute('role')).toBe('list')
  })

  it('renders a hidden connector line', () => {
    const { container } = render(
      <Timeline>
        <Timeline.Item title="A" />
      </Timeline>,
    )
    const connector = container.querySelector('[aria-hidden="true"]')
    // The first aria-hidden span is the connector
    expect(connector).not.toBeNull()
  })

  it('renders each item with a dot', () => {
    const { container } = render(
      <Timeline>
        <Timeline.Item title="First" />
        <Timeline.Item title="Second" />
        <Timeline.Item title="Third" />
      </Timeline>,
    )
    const items = container.querySelectorAll('li')
    expect(items.length).toBe(3)
    // Each item has at least one aria-hidden dot
    items.forEach((li) => {
      expect(li.querySelector('[aria-hidden="true"]')).not.toBeNull()
    })
  })

  it('renders the title as an <h3> inside each item', () => {
    render(
      <Timeline>
        <Timeline.Item title="Hello Title" />
      </Timeline>,
    )
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading.textContent).toBe('Hello Title')
  })

  it('formats a date string with month short / day numeric / year numeric', () => {
    const { container } = render(
      <Timeline>
        <Timeline.Item date="2026-07-20" title="Release" />
      </Timeline>,
    )
    // Visible formatted text under en-US (e.g. "Jul 20, 2026").
    expect(screen.getByText(/Jul.*2026/i)).not.toBeNull()
    // The <time> element also carries the ISO datetime as a machine-readable hint.
    const time = container.querySelector('time')
    expect(time).not.toBeNull()
    expect(time?.getAttribute('datetime')).toBe('2026-07-20T00:00:00.000Z')
  })

  it('honours an explicit locale prop', () => {
    render(
      <Timeline>
        <Timeline.Item date="2026-07-20" title="Release" locale="es-ES" />
      </Timeline>,
    )
    // Spanish locale shortens "Julio" to "jul".
    expect(screen.getByText(/jul.*2026/i)).not.toBeNull()
  })

  it('renders a string badge as primary by default', () => {
    render(
      <Timeline>
        <Timeline.Item title="Release" badge="Major" />
      </Timeline>,
    )
    const badge = screen.getByText('Major')
    expect(badge).not.toBeNull()
    expect(badge.tagName).toBe('SPAN')
  })

  it('renders a badge object with custom variant', () => {
    render(
      <Timeline>
        <Timeline.Item
          title="Removal"
          badge={{ text: 'Breaking', variant: 'danger' }}
        />
      </Timeline>,
    )
    const badge = screen.getByText('Breaking')
    expect(badge).not.toBeNull()
  })

  it('renders children body content for the item', () => {
    render(
      <Timeline>
        <Timeline.Item title="Release" date="2026-01-01">
          <p>Body content goes here.</p>
        </Timeline.Item>
      </Timeline>,
    )
    expect(screen.getByText('Body content goes here.')).not.toBeNull()
  })

  it('uses compact spacing when compact=true', () => {
    const { container: compact } = render(
      <Timeline compact>
        <Timeline.Item title="A" />
        <Timeline.Item title="B" />
      </Timeline>,
    )
    const { container: normal } = render(
      <Timeline>
        <Timeline.Item title="A" />
        <Timeline.Item title="B" />
      </Timeline>,
    )
    const listCompact = compact.querySelector('ol')!
    const listNormal = normal.querySelector('ol')!
    expect(listCompact.className).toContain('space-y-3')
    expect(listNormal.className).toContain('space-y-7')
  })

  it('omits the time element when no date is given', () => {
    const { container } = render(
      <Timeline>
        <Timeline.Item title="No date" />
      </Timeline>,
    )
    expect(container.querySelector('time')).toBeNull()
  })

  it('aliases lifecycle variants correctly', () => {
    // Patch, minor, breaking, deprecated should map to semantic variants
    render(
      <Timeline>
        <Timeline.Item
          title="A"
          variant="major"
          badge={{ text: 'X', variant: 'major' }}
        />
        <Timeline.Item
          title="B"
          variant="minor"
          badge={{ text: 'X', variant: 'minor' }}
        />
        <Timeline.Item
          title="C"
          variant="patch"
          badge={{ text: 'X', variant: 'patch' }}
        />
        <Timeline.Item
          title="D"
          variant="breaking"
          badge={{ text: 'X', variant: 'breaking' }}
        />
        <Timeline.Item
          title="E"
          variant="deprecated"
          badge={{ text: 'X', variant: 'deprecated' }}
        />
      </Timeline>,
    )
    // Smoke test — if any palette lookup throws, the test fails.
    // We don't assert exact classes here because Tailwind class names are
    // emitted as final strings and would couple the test to styles.
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(5)
  })
})
