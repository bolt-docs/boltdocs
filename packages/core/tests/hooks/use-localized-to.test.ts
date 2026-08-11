import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLocalizedTo } from '../../src/client/hooks/use-localized-to'
import { useConfig } from '../../src/client/app/config-context'
import { useRoutesContext } from '../../src/client/app/routes-context'
import { useBoltdocsContext } from '../../src/client/store/boltdocs-context'

vi.mock('../../src/client/app/config-context')
vi.mock('../../src/client/app/routes-context')
vi.mock('../../src/client/store/boltdocs-context')

type TestRoute = {
  path: string
  version?: string
  collection?: string
}

function setContext(
  routes: TestRoute[] = [],
  currentLocale?: string,
  currentVersion?: string,
) {
  const byPath = new Map(
    routes.map((route) => [route.path.replace(/\/$/, '') || '/', route]),
  )
  const hintsByPath = new Map(
    routes.map((route) => [
      route.path.replace(/\/$/, '') || '/',
      {
        path: route.path,
        kind: route.collection ? ('collection' as const) : undefined,
        collection: route.collection,
      },
    ]),
  )

  vi.mocked(useRoutesContext).mockReturnValue({
    routes: routes as never,
    index: {
      byPath,
      hintsByPath,
      collectionNames: routes
        .map((route) => route.collection)
        .filter((collection): collection is string => Boolean(collection)),
    },
  })
  vi.mocked(useBoltdocsContext).mockReturnValue({
    currentLocale: currentLocale as never,
    currentVersion: currentVersion as never,
    hasHydrated: true,
    setLocale: vi.fn(),
    setVersion: vi.fn(),
    setHasHydrated: vi.fn(),
  })
}

function localized(to: string) {
  return renderHook(() => useLocalizedTo(to)).result.current
}

describe('useLocalizedTo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useConfig).mockReturnValue({ base: '/docs' } as never)
    setContext()
  })

  it('returns external links and anchors as-is', () => {
    expect(localized('https://google.com')).toBe('https://google.com')
    expect(localized('//google.com')).toBe('//google.com')
    expect(localized('#anchor')).toBe('#anchor')
  })

  it('returns site links without the protocol prefix', () => {
    expect(localized('site:/roadmap')).toBe('/roadmap')
  })

  it('prefixes unknown internal links with the base path', () => {
    expect(localized('/guides/intro')).toBe('/docs/guides/intro')
  })

  it('does not prefix known external routes', () => {
    setContext([{ path: '/roadmap' }, { path: '/docs/guides/intro' }])

    expect(localized('/roadmap')).toBe('/roadmap')
    expect(localized('/docs/guides/intro')).toBe('/docs/guides/intro')
    expect(localized('/unknown')).toBe('/docs/unknown')
  })

  it('preserves trailing slashes for known routes', () => {
    setContext([{ path: '/roadmap/' }])

    expect(localized('/roadmap')).toBe('/roadmap')
    expect(localized('/roadmap/')).toBe('/roadmap/')
  })

  it('preserves query parameters and hashes for known routes', () => {
    setContext([{ path: '/roadmap' }])

    expect(localized('/roadmap?s=1')).toBe('/roadmap?s=1')
    expect(localized('/roadmap#hash')).toBe('/roadmap#hash')
  })

  it('handles i18n and versions for unknown documentation links', () => {
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      i18n: { defaultLocale: 'en', locales: { en: 'EN', es: 'ES' } },
      versions: {
        defaultVersion: 'v1',
        versions: [{ path: 'v1', label: 'v1' }],
      },
    } as never)
    setContext([], 'es', 'v1')

    expect(localized('/guides/intro')).toBe('/docs/v1/es/guides/intro')
  })

  it('ignores a stale version preference when versioning is disabled', () => {
    vi.mocked(useConfig).mockReturnValue({ base: '/docs' } as never)
    setContext([], 'en', 'next')

    expect(localized('/guides/getting-started/file-routing')).toBe(
      '/docs/guides/getting-started/file-routing',
    )
  })

  it('preserves an explicit version over the active version', () => {
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      i18n: { defaultLocale: 'en', locales: { en: 'EN', es: 'ES' } },
      versions: {
        defaultVersion: 'v1',
        versions: [
          { path: 'v1', label: 'v1' },
          { path: 'v2', label: 'v2' },
        ],
      },
    } as never)
    setContext([], 'en', 'v1')

    expect(localized('/docs/v2/guides/intro')).toBe('/docs/v2/guides/intro')
  })

  it('does not add the default locale prefix', () => {
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      i18n: { defaultLocale: 'en', locales: { en: 'EN', es: 'ES' } },
    } as never)
    setContext([], 'en')

    expect(localized('/docs/guides')).toBe('/docs/guides')
    expect(localized('/guides/intro')).toBe('/docs/guides/intro')
    expect(localized('site:/')).toBe('/')
    expect(localized('site:')).toBe('/')
  })

  it('adds the active locale for site root links', () => {
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      i18n: { defaultLocale: 'en', locales: { en: 'EN', es: 'ES' } },
    } as never)
    setContext([], 'es')

    expect(localized('site:/')).toBe('/es')
    expect(localized('site:')).toBe('/es')
  })
})
