import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLocalizedTo } from '../../src/client/hooks/use-localized-to'
import { useConfig } from '../../src/client/app/config-context'
import { useRoutes } from '../../src/client/hooks/use-routes'

// Mock the dependencies of the hook
vi.mock('../../src/client/app/config-context')
vi.mock('../../src/client/hooks/use-routes')

describe('useLocalizedTo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return external links as-is', () => {
    ;(useConfig as any).mockReturnValue({ base: '/docs' })
    ;(useRoutes as any).mockReturnValue({ allRoutes: [] })

    expect(useLocalizedTo('https://google.com')).toBe('https://google.com')
    expect(useLocalizedTo('//google.com')).toBe('//google.com')
    expect(useLocalizedTo('#anchor')).toBe('#anchor')
  })

  it('should return site: links without the prefix', () => {
    ;(useConfig as any).mockReturnValue({ base: '/docs' })
    ;(useRoutes as any).mockReturnValue({ allRoutes: [] })

    expect(useLocalizedTo('site:/roadmap')).toBe('/roadmap')
  })

  it('should prefix internal links with base path by default', () => {
    ;(useConfig as any).mockReturnValue({ base: '/docs' })
    ;(useRoutes as any).mockReturnValue({ allRoutes: [] })

    expect(useLocalizedTo('/guides/intro')).toBe('/docs/guides/intro')
  })

  it('should NOT prefix if the path matches a known route (external page fix)', () => {
    ;(useConfig as any).mockReturnValue({ base: '/docs' })
    ;(useRoutes as any).mockReturnValue({
      allRoutes: [{ path: '/roadmap' }, { path: '/docs/guides/intro' }],
    })

    // 1. Should NOT prefix /roadmap because it's in allRoutes (external page)
    expect(useLocalizedTo('/roadmap')).toBe('/roadmap')

    // 2. Should still correctly handle doc links that are already prefixed
    expect(useLocalizedTo('/docs/guides/intro')).toBe('/docs/guides/intro')

    // 3. Should STILL prefix unknown links (assuming they are doc paths without base)
    expect(useLocalizedTo('/unknown')).toBe('/docs/unknown')
  })

  it('should handle trailing slashes in route matching correctly', () => {
    ;(useConfig as any).mockReturnValue({ base: '/docs' })
    ;(useRoutes as any).mockReturnValue({
      allRoutes: [{ path: '/roadmap/' }],
    })

    // Both should match /roadmap/ and thus NOT be prefixed
    expect(useLocalizedTo('/roadmap')).toBe('/roadmap')
    expect(useLocalizedTo('/roadmap/')).toBe('/roadmap/')
  })

  it('should handle query parameters and hashes in route matching correctly', () => {
    ;(useConfig as any).mockReturnValue({ base: '/docs' })
    ;(useRoutes as any).mockReturnValue({
      allRoutes: [{ path: '/roadmap' }],
    })

    // Should ignore query/hash when checking for known routes, then return original
    expect(useLocalizedTo('/roadmap?s=1')).toBe('/roadmap?s=1')
    expect(useLocalizedTo('/roadmap#hash')).toBe('/roadmap#hash')
  })

  it('should handle i18n and versions if NOT a known route', () => {
    ;(useConfig as any).mockReturnValue({
      base: '/docs',
      i18n: { defaultLocale: 'en', locales: { en: 'EN', es: 'ES' } },
      versions: {
        defaultVersion: 'v1',
        versions: [{ path: 'v1', label: 'v1' }],
      },
    })
    ;(useRoutes as any).mockReturnValue({
      currentLocale: 'es',
      currentVersion: 'v1',
      allRoutes: [],
    })

    expect(useLocalizedTo('/guides/intro')).toBe('/docs/v1/es/guides/intro')
  })
})
