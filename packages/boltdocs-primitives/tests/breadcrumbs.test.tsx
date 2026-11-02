import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import {
  Breadcrumb,
  Breadcrumbs,
  BreadcrumbsSeparator,
} from '../src/breadcrumbs'

describe('Breadcrumbs', () => {
  it('is a navigation landmark containing an ordered list', () => {
    render(
      <Breadcrumbs aria-label="Breadcrumb">
        <Breadcrumb>
          <a href="/">Home</a>
        </Breadcrumb>
        <Breadcrumb aria-current="page">Guides</Breadcrumb>
      </Breadcrumbs>,
    )

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    // A flat set of links loses the path; the list is what conveys it.
    expect(within(nav).getByRole('list')).toBeInTheDocument()
    expect(within(nav).getAllByRole('listitem')).toHaveLength(2)
  })

  it('marks the current crumb with aria-current', () => {
    render(
      <Breadcrumbs aria-label="Breadcrumb">
        <Breadcrumb>
          <a href="/">Home</a>
        </Breadcrumb>
        <Breadcrumb aria-current="page">Guides</Breadcrumb>
      </Breadcrumbs>,
    )
    // Queried by index, not by name: `listitem` is not a role that takes its
    // accessible name from content, so a name query finds nothing.
    const crumbs = screen.getAllByRole('listitem')
    expect(crumbs[1]).toHaveAttribute('aria-current', 'page')
    expect(crumbs[1]).toHaveTextContent('Guides')
    expect(crumbs[0]).not.toHaveAttribute('aria-current')
  })

  it('hides the separator from assistive tech by default', () => {
    render(
      <Breadcrumbs aria-label="Breadcrumb">
        <Breadcrumb>
          <a href="/">Home</a>
        </Breadcrumb>
        <BreadcrumbsSeparator>/</BreadcrumbsSeparator>
        <Breadcrumb aria-current="page">Guides</Breadcrumb>
      </Breadcrumbs>,
    )
    // A chevron between every pair is noise that pushes the names apart in speech.
    expect(screen.queryByText('/')).toHaveAttribute('aria-hidden', 'true')
  })

  it('lets the separator be exposed when it carries meaning', () => {
    render(
      <Breadcrumbs aria-label="Breadcrumb">
        <BreadcrumbsSeparator decorative={false}>/</BreadcrumbsSeparator>
      </Breadcrumbs>,
    )
    expect(screen.getByText('/')).not.toHaveAttribute('aria-hidden')
  })

  it('does not invent a label for the landmark', () => {
    render(<Breadcrumbs aria-label="You are here">Home</Breadcrumbs>)
    expect(
      screen.getByRole('navigation', { name: 'You are here' }),
    ).toBeInTheDocument()
  })
})
