import { describe, expect, it } from 'vitest'
import type { BoltdocsConfig } from '../../src/shared/types'
import { buildExternalFileRoutes } from '../../src/client/ssg/create-routes.external.tsx'

const config: BoltdocsConfig = {
  i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
  experimental: { fileRouting: true },
}

const pageA = () => null
const pageEs = () => null

describe('buildExternalFileRoutes locale selection', () => {
  it('prefers the localized file and falls back to the default file', () => {
    const { children, metadata } = buildExternalFileRoutes({
      externalFilePages: {
        '/about': pageA,
        '/es/about': pageEs,
      },
      externalFileMdx: {},
      config,
    })

    // No `/en/about`. The default locale is already the unprefixed path, so a
    // prefixed variant would be a second URL for the same page — and on a site
    // served under a base the SSG emitted `/docs/en/about`, a URL the client
    // router never learns about, so it answered 404 to a page the build had
    // itself written.
    const paths = children.map((route) => route.path)
    expect(paths).toEqual(['/about', '/es/about'])
    expect(paths).not.toContain('/en/about')

    const locales = metadata.map((route) => route.locale)
    expect(locales).toEqual(['en', 'es'])

    // The real Spanish file owns /es/about; the base page serves the rest.
    const esRoute = children.find((route) => route.path === '/es/about')
    const enRoute = children.find((route) => route.path === '/about')
    expect(esRoute?.element).toBeTruthy()
    expect(esRoute?.locale).toBe('es')
    expect(enRoute?.element).toBeTruthy()
    expect(enRoute?.locale).toBe('en')
  })

  it('does not prefix the default locale', () => {
    const { children } = buildExternalFileRoutes({
      externalFilePages: { '/roadmap': pageA },
      externalFileMdx: {},
      config,
    })

    const prefixed = children
      .map((route) => route.path)
      .filter((p) => /^\/en\//.test(p))
    expect(prefixed).toEqual([])
  })

  it('still generates the root variant for the home page', () => {
    const { children } = buildExternalFileRoutes({
      externalFilePages: { '/': pageA },
      externalFileMdx: {},
      config,
    })

    const paths = children.map((route) => route.path)
    expect(paths).toContain('/')
    // `/en` would be the prefixed default locale for the home page.
    expect(paths).not.toContain('/en')
    expect(paths).toContain('/es')
  })

  it('does not invent variants for already-localized routes', () => {
    const { children } = buildExternalFileRoutes({
      externalFilePages: { '/es/about': pageEs },
      externalFileMdx: {},
      config,
    })

    const paths = children.map((route) => route.path)
    expect(paths).toEqual(['/es/about'])
  })
})
