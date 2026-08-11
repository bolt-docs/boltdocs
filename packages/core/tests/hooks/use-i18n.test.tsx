import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useI18n } from '../../src/client/hooks/use-i18n'
import { useLocation, useNavigate } from '../../src/client/router'
import { useConfig } from '../../src/client/app/config-context'
import { useRoutes } from '../../src/client/hooks/use-routes'
import { useBoltdocsContext } from '../../src/client/store/boltdocs-context'

vi.mock('../../src/client/router', () => ({
  useLocation: vi.fn(),
  useNavigate: vi.fn(),
}))
vi.mock('../../src/client/app/config-context')
vi.mock('../../src/client/hooks/use-routes')
vi.mock('../../src/client/store/boltdocs-context')

type Route = {
  path: string
  filePath: string
  locale?: string
  version?: string
  collection?: string
}

const navigate = vi.fn()
const setLocale = vi.fn()

function configure({
  currentRoute,
  allRoutes,
  currentLocale,
  currentVersion,
}: {
  currentRoute: Route
  allRoutes: Route[]
  currentLocale: string
  currentVersion?: string
}) {
  vi.mocked(useNavigate).mockReturnValue(navigate)
  vi.mocked(useLocation).mockReturnValue({
    pathname: currentRoute.path,
    search: '',
    hash: '',
  })
  vi.mocked(useConfig).mockReturnValue({
    base: '/docs',
    i18n: {
      defaultLocale: 'en',
      locales: { en: 'English', es: 'Español' },
    },
  } as never)
  vi.mocked(useRoutes).mockReturnValue({
    allRoutes,
    currentRoute,
    currentLocale,
    currentVersion,
    isCollectionPage: false,
    routes: allRoutes,
  } as never)
  vi.mocked(useBoltdocsContext).mockReturnValue({
    currentLocale,
    currentVersion: currentVersion || '',
    setLocale,
    setVersion: vi.fn(),
    hasHydrated: true,
    setHasHydrated: vi.fn(),
  })
}

describe('useI18n locale navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('navigates to the translated MDX route when changing locale', () => {
    const englishRoute: Route = {
      path: '/docs/guides/getting-started',
      filePath: 'guides/getting-started.mdx',
    }
    const spanishRoute: Route = {
      path: '/docs/es/guides/getting-started',
      filePath: 'es/guides/getting-started.mdx',
      locale: 'es',
    }

    configure({
      currentRoute: englishRoute,
      allRoutes: [englishRoute, spanishRoute],
      currentLocale: 'en',
    })

    const { result } = renderHook(() => useI18n())
    result.current.handleLocaleChange('es')

    expect(setLocale).toHaveBeenCalledWith('es')
    expect(navigate).toHaveBeenCalledWith('/docs/es/guides/getting-started')
  })

  it('navigates from a translated MDX route back to the default locale', () => {
    const englishRoute: Route = {
      path: '/docs/guides/getting-started',
      filePath: 'guides/getting-started.mdx',
    }
    const spanishRoute: Route = {
      path: '/docs/es/guides/getting-started',
      filePath: 'es/guides/getting-started.mdx',
      locale: 'es',
    }

    configure({
      currentRoute: spanishRoute,
      allRoutes: [englishRoute, spanishRoute],
      currentLocale: 'es',
    })

    const { result } = renderHook(() => useI18n())
    result.current.handleLocaleChange('en')

    expect(setLocale).toHaveBeenCalledWith('en')
    expect(navigate).toHaveBeenCalledWith('/docs/guides/getting-started')
  })

  it('preserves the active version while switching to a translated MDX route', () => {
    const englishRoute: Route = {
      path: '/docs/v2/guides/getting-started',
      filePath: 'v2/guides/getting-started.mdx',
      version: 'v2',
    }
    const spanishRoute: Route = {
      path: '/docs/v2/es/guides/getting-started',
      filePath: 'v2/es/guides/getting-started.mdx',
      locale: 'es',
      version: 'v2',
    }

    configure({
      currentRoute: englishRoute,
      allRoutes: [englishRoute, spanishRoute],
      currentLocale: 'en',
      currentVersion: 'v2',
    })

    const { result } = renderHook(() => useI18n())
    result.current.handleLocaleChange('es')

    expect(setLocale).toHaveBeenCalledWith('es')
    expect(navigate).toHaveBeenCalledWith('/docs/v2/es/guides/getting-started')
  })
})
