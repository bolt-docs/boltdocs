import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DocsLayout } from '../../src/client/components/primitives/docs-layout'

vi.mock('../../src/client/components/ui-base/search-highlight', () => ({
  SearchHighlight: () => null,
}))

describe('DocsLayout.ContentMdx', () => {
  it('does not bake padding by default — the theme controls spacing via className', () => {
    const html = renderToStaticMarkup(
      <DocsLayout.ContentMdx>Hello</DocsLayout.ContentMdx>,
    )
    expect(html).toContain('class="boltdocs-page w-full"')
    expect(html).not.toContain('pt-4')
    expect(html).not.toContain('pb-20')
  })

  it('merges a plain theme padding without responsive conflicts', () => {
    const html = renderToStaticMarkup(
      <DocsLayout.ContentMdx className="pt-4 pb-20 px-28">
        Hello
      </DocsLayout.ContentMdx>,
    )
    expect(html).toContain('class="boltdocs-page w-full pt-4 pb-20 px-28"')
    expect(html).not.toContain('sm:px-8')
  })

  it('applies contentClassName to the inner reading column', () => {
    const html = renderToStaticMarkup(
      <DocsLayout.ContentMdx contentClassName="max-w-7xl">
        Hello
      </DocsLayout.ContentMdx>,
    )
    expect(html).toContain('max-w-7xl')
    expect(html).not.toContain('max-w-3xl')
  })
})
