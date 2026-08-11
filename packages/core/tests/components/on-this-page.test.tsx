import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OnThisPage } from '../../src/client/components/primitives/on-this-page'

describe('OnThisPage content gradient', () => {
  it('keeps links opaque while retaining a decorative bottom gradient', () => {
    const { container } = render(
      <OnThisPage.Content>
        <div data-testid="toc-links">
          <a href="#section">Section</a>
        </div>
      </OnThisPage.Content>,
    )

    const content = container.firstElementChild
    const links = screen.getByTestId('toc-links')
    const linksLayer = links.parentElement
    const gradient = container.querySelector('[aria-hidden="true"]')

    expect(content).not.toHaveStyle({ maskImage: expect.any(String) })
    expect(content).not.toHaveStyle({ WebkitMaskImage: expect.any(String) })
    expect(linksLayer).toHaveClass('relative', 'z-10')
    expect(gradient).toHaveClass('pointer-events-none', 'sticky', 'z-0')
  })
})
