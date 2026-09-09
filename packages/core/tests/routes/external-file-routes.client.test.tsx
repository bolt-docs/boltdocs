import { describe, expect, it } from 'vitest'
import type { BoltdocsConfig } from '../../src/shared/types'
import { buildExternalFileRoutes } from '../../src/client/ssg/create-routes.external'

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

    const paths = children.map((route) => route.path)
    expect(paths).toEqual(['/about', '/es/about', '/en/about'])

    const locales = metadata.map((route) => route.locale)
    expect(locales).toEqual(['en', 'es', 'en'])

    // The real Spanish file owns /es/about; the base page serves the rest.
    const esRoute = children.find((route) => route.path === '/es/about')
    const enRoute = children.find((route) => route.path === '/en/about')
    expect(esRoute?.element).toBeTruthy()
    expect(esRoute?.locale).toBe('es')
    expect(enRoute?.element).toBeTruthy()
    expect(enRoute?.locale).toBe('en')
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
