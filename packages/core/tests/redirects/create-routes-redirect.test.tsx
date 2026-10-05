import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { buildRedirectRoutes } from '../../src/client/ssg/create-routes.redirect.tsx'
import type { BoltdocsConfig } from '../../src/shared/types'

function renderAt(path: string, config: BoltdocsConfig): string {
  const routes = buildRedirectRoutes({ config })
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {routes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
        <Route path="*" element={<p>not found</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('buildRedirectRoutes', () => {
  it('returns no routes when redirects are not configured', () => {
    expect(buildRedirectRoutes({ config: {} })).toEqual([])
  })

  it('builds a route per redirect source', () => {
    const routes = buildRedirectRoutes({
      config: {
        redirects: [
          { from: '/old', to: '/new' },
          { from: '/legacy', to: '/new' },
        ],
      },
    })

    expect(routes.map((route) => route.path)).toEqual(['/legacy', '/old'])
  })

  it('applies the base to internal targets', () => {
    const markup = renderAt('/old', {
      base: '/docs',
      redirects: [{ from: '/old', to: '/guides/start' }],
    })

    expect(markup).toContain('/docs/guides/start')
  })

  it('renders a fallback link for the redirect destination', () => {
    const markup = renderAt('/old', {
      redirects: [{ from: '/old', to: '/new' }],
    })

    expect(markup).toContain('Redirecting to')
    expect(markup).toContain('/new')
  })

  it('keeps external destinations as absolute URLs', () => {
    const markup = renderAt('/old', {
      redirects: [{ from: '/old', to: 'https://example.com' }],
    })

    expect(markup).toContain('https://example.com')
  })

  it('collapses redirect chains in the browser map', () => {
    const markup = renderAt('/a', {
      redirects: [
        { from: '/a', to: '/b' },
        { from: '/b', to: '/c' },
      ],
    })

    expect(markup).toContain('/c')
  })

  it('mirrors redirects across locales when requested', () => {
    const routes = buildRedirectRoutes({
      config: {
        i18n: { defaultLocale: 'en', locales: ['en', 'es'] },
        redirects: [{ from: '/old', to: '/new', locale: true }],
      },
    })

    expect(routes.map((route) => route.path)).toEqual(['/en/old', '/es/old'])
  })

  it('falls through to not-found for unrelated paths', () => {
    const markup = renderAt('/unrelated', {
      redirects: [{ from: '/old', to: '/new' }],
    })

    expect(markup).toContain('not found')
  })
})
