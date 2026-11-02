import { describe, expect, it } from 'vitest'
import { renderRedirectHtml } from '../../src/node/pipeline/steps/redirects-write'
import { resolveRedirects } from '../../src/node/redirects'

describe('renderRedirectHtml', () => {
  it('emits a meta refresh, canonical link, and history-safe script', () => {
    const [redirect] = resolveRedirects({
      config: { redirects: [{ from: '/old', to: '/new' }] },
    })
    const html = renderRedirectHtml(redirect, 'https://boltdocs.dev')

    expect(html).toContain(
      '<meta http-equiv="refresh" content="0; url=/new" />',
    )
    expect(html).toContain(
      '<link rel="canonical" href="https://boltdocs.dev/new" />',
    )
    expect(html).toContain('window.location.replace("/new")')
    expect(html).toContain('<a href="/new">/new</a>')
  })

  it('escapes HTML in the destination', () => {
    const [redirect] = resolveRedirects({
      config: { redirects: [{ from: '/old', to: '/a?x=<script>' }] },
    })
    const html = renderRedirectHtml(redirect)

    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })

  it('marks redirect documents as noindex', () => {
    const [redirect] = resolveRedirects({
      config: { redirects: [{ from: '/old', to: '/new' }] },
    })

    expect(renderRedirectHtml(redirect)).toContain('noindex, follow')
  })
})
