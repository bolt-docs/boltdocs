import { describe, it, expect } from 'vitest'
import { enrichRouteSeo } from '../src/node/enrich'
import type { RouteMeta } from '@bdocs/contracts'

describe('enrichRouteSeo', () => {
  const siteUrl = 'https://example.com'
  const silent = () => {}

  it('resolves canonical and og:url from siteUrl', () => {
    const routes = [{ path: '/docs/x' }] as RouteMeta[]
    enrichRouteSeo(routes, { siteUrl }, silent)

    expect(routes[0].seo).toMatchObject({
      canonical: 'https://example.com/docs/x',
      'og:url': 'https://example.com/docs/x',
    })
  })

  it('keeps an explicit canonical and prefers it for og:url', () => {
    const routes = [
      { path: '/docs/x', seo: { canonical: 'https://other.example/x' } },
    ] as RouteMeta[]
    enrichRouteSeo(routes, { siteUrl }, silent)

    expect(routes[0].seo).toMatchObject({
      canonical: 'https://other.example/x',
      'og:url': 'https://other.example/x',
    })
  })

  it('mutates route objects in place rather than replacing the array', () => {
    // The same RouteMeta[] reference has already been handed to Vite's virtual
    // modules, so a new array here would leave them holding stale metadata.
    const routes = [{ path: '/docs/x' }] as RouteMeta[]
    const same = routes[0]
    enrichRouteSeo(routes, { siteUrl }, silent)

    expect(routes[0]).toBe(same)
    expect(same.seo).toBeDefined()
  })

  it('absolutizes a relative og:image against siteUrl', () => {
    const routes = [
      { path: '/docs/x', seo: { 'og:image': '/img/a.png' } },
    ] as RouteMeta[]
    enrichRouteSeo(routes, { siteUrl }, silent)

    expect((routes[0].seo as Record<string, unknown>)['og:image']).toBe(
      'https://example.com/img/a.png',
    )
  })

  it('leaves an absolute og:image untouched', () => {
    const routes = [
      { path: '/docs/x', seo: { 'og:image': 'https://cdn.example/a.png' } },
    ] as RouteMeta[]
    enrichRouteSeo(routes, { siteUrl }, silent)

    expect((routes[0].seo as Record<string, unknown>)['og:image']).toBe(
      'https://cdn.example/a.png',
    )
  })

  it('falls back to coverImage, then to the configured thumbnail', () => {
    const fromCover = [{ path: '/a', coverImage: '/c.png' }] as RouteMeta[]
    enrichRouteSeo(fromCover, { siteUrl }, silent)
    expect((fromCover[0].seo as Record<string, unknown>)['og:image']).toBe(
      'https://example.com/c.png',
    )

    const fromConfig = [{ path: '/b' }] as RouteMeta[]
    enrichRouteSeo(
      fromConfig,
      {
        siteUrl,
        seo: { thumbnails: { background: '/t.png' } },
      },
      silent,
    )
    expect((fromConfig[0].seo as Record<string, unknown>)['og:image']).toBe(
      'https://example.com/t.png',
    )
  })

  it('derives og:title and og:description from title and description', () => {
    const routes = [
      { path: '/a', title: 'Alpha', description: 'First' },
    ] as RouteMeta[]
    enrichRouteSeo(routes, { siteUrl }, silent)

    expect(routes[0].seo).toMatchObject({
      'og:title': 'Alpha',
      'og:description': 'First',
    })
  })

  it('does not overwrite explicit og:title', () => {
    const routes = [
      { path: '/a', title: 'Alpha', seo: { 'og:title': 'Custom' } },
    ] as RouteMeta[]
    enrichRouteSeo(routes, { siteUrl }, silent)

    expect((routes[0].seo as Record<string, unknown>)['og:title']).toBe(
      'Custom',
    )
  })

  it('warns on a malformed url but keeps the route usable', () => {
    const warnings: string[] = []
    const routes = [
      { path: '/a', seo: { canonical: 'not-a-url' } },
    ] as RouteMeta[]
    enrichRouteSeo(routes, { siteUrl }, (m) => warnings.push(m))

    expect(
      warnings.some((w) => w.includes('not-a-url') || w.includes('Invalid')),
    ).toBe(true)
    expect((routes[0].seo as Record<string, unknown>).canonical).toBe(
      'not-a-url',
    )
  })

  it('warns when a route has no title', () => {
    const warnings: string[] = []
    enrichRouteSeo([{ path: '/a' }] as RouteMeta[], { siteUrl }, (m) =>
      warnings.push(m),
    )

    expect(warnings.some((w) => w.includes('missing a title'))).toBe(true)
  })

  it('does not warn about vendor-prefixed keys the client renders', () => {
    const warnings: string[] = []
    const routes = [
      {
        path: '/a',
        title: 'T',
        seo: { 'article:tag': 'x', 'music:duration': '3:00' },
      },
    ] as RouteMeta[]
    enrichRouteSeo(routes, { siteUrl }, (m) => warnings.push(m))

    expect(warnings).toEqual([])
  })

  it('produces nothing canonical when siteUrl is unset', () => {
    const routes = [{ path: '/a', title: 'T' }] as RouteMeta[]
    enrichRouteSeo(routes, {}, silent)

    expect(routes[0].seo).not.toHaveProperty('canonical')
    expect(routes[0].seo).not.toHaveProperty('og:url')
  })
})
