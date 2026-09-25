import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SearchResultHighlight } from '../../src/client/components/ui-base/search-dialog'
import Navbar from '../../src/client/components/primitives/navbar'

describe('SearchResultHighlight', () => {
  it('marks repeated and accented matches without global RegExp state leaking', () => {
    const { container } = render(
      <SearchResultHighlight
        text="Config config and configuración"
        query="config"
      />,
    )

    expect(
      [...container.querySelectorAll('mark')].map((mark) => mark.textContent),
    ).toEqual(['Config', 'config', 'config'])
  })

  it('forwards accessible labels and shortcut metadata to search triggers', () => {
    render(
      <>
        <Navbar.SearchTrigger.Desktop
          aria-label="Search documentation"
          aria-keyshortcuts="Control+K"
          onPress={() => {}}
        >
          Search
        </Navbar.SearchTrigger.Desktop>
        <Navbar.SearchTrigger.Mobile
          aria-label="Open documentation search"
          onPress={() => {}}
        >
          Search
        </Navbar.SearchTrigger.Mobile>
      </>,
    )

    expect(
      screen.getByRole('button', { name: 'Search documentation' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Open documentation search' }),
    ).toBeInTheDocument()
  })

  it('renders regex metacharacters literally', () => {
    render(<SearchResultHighlight text="Use config.* now" query="config.*" />)

    expect(screen.getByText('config.*').tagName).toBe('MARK')
  })
})
