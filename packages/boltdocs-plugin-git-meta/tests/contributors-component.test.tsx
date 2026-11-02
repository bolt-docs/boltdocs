// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RouteContributor } from 'boltdocs/client'
import { Contributors, GitMetaFooter, LastUpdated } from '../src/client/index'

const contributors: RouteContributor[] = [
  {
    name: 'Alice Smith',
    commits: 12,
    avatar: 'https://github.com/alice.png?size=64',
    url: 'https://github.com/alice',
  },
  { name: 'Bob Jones', commits: 3 },
  { name: 'Carol', commits: 2 },
]

describe('Contributors', () => {
  it('renders avatars, names, and profile links', () => {
    const { container } = render(<Contributors contributors={contributors} />)

    expect(screen.getByText('Alice Smith')).toBeTruthy()
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('')
    expect(
      container.querySelector('a[href="https://github.com/alice"]'),
    ).toBeTruthy()
    expect(screen.getByLabelText('Contributors')).toBeTruthy()
  })

  it('collapses contributors beyond max', () => {
    render(<Contributors contributors={contributors} max={2} />)
    expect(screen.getByText(/\+1/)).toBeTruthy()
    expect(screen.queryByText(/Carol/)).toBeNull()
  })

  it('honours custom labels, class slots, and show flags', () => {
    const { container } = render(
      <Contributors
        contributors={contributors}
        label="Autores"
        showAvatars={false}
        className="root-x"
        classNames={{ names: 'names-x', link: 'link-x' }}
      />,
    )

    expect(container.querySelector('.root-x')).toBeTruthy()
    expect(container.querySelector('.names-x')).toBeTruthy()
    expect(container.querySelector('.link-x')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByLabelText('Autores')).toBeTruthy()
  })

  it('supports a custom contributor renderer', () => {
    render(
      <Contributors
        contributors={contributors.slice(0, 2)}
        renderContributor={(contributor) => (
          <strong data-testid="custom">{contributor.name.toUpperCase()}</strong>
        )}
      />,
    )
    expect(screen.getAllByTestId('custom')).toHaveLength(2)
    expect(screen.getByText('ALICE SMITH')).toBeTruthy()
  })

  it('renders nothing without contributors', () => {
    const { container } = render(<Contributors />)
    expect(container.firstChild).toBeNull()
  })
})

describe('LastUpdated', () => {
  it('renders a custom label and formatter', () => {
    render(
      <LastUpdated
        date="2026-01-15T10:00:00.000Z"
        label="Actualizado el"
        formatDate={() => '15/01/2026'}
        className="date-x"
      />,
    )
    expect(screen.getByText(/Actualizado el 15\/01\/2026/)).toBeTruthy()
  })

  it('renders nothing without a valid date', () => {
    const { container } = render(<LastUpdated date="not-a-date" />)
    expect(container.firstChild).toBeNull()
  })
})

describe('GitMetaFooter', () => {
  it('composes contributors and date with custom labels', () => {
    render(
      <GitMetaFooter
        date="2026-01-15T10:00:00.000Z"
        contributors={contributors}
        labels={{ contributors: 'Autores', lastUpdated: 'Actualizado el' }}
        formatDate={() => '15/01/2026'}
      />,
    )
    expect(screen.getByLabelText('Autores')).toBeTruthy()
    expect(screen.getByText(/Actualizado el 15\/01\/2026/)).toBeTruthy()
  })

  it('can hide one of the halves', () => {
    render(
      <GitMetaFooter
        date="2026-01-15T10:00:00.000Z"
        contributors={contributors}
        showContributors={false}
      />,
    )
    expect(screen.queryByLabelText('Contributors')).toBeNull()
    expect(screen.getByText(/Last updated on/)).toBeTruthy()
  })

  it('renders nothing when both halves are empty', () => {
    const { container } = render(<GitMetaFooter />)
    expect(container.firstChild).toBeNull()
  })
})
