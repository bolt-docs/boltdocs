import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConfig, useLocation, useNavigate } from '@bdocs/runtime'
import { useI18n } from '../src/hooks/use-i18n'
import { useRoutes } from '../src/hooks/use-routes'
import { useBoltdocsContext } from '../src/store/boltdocs-context'

// The hook reads its navigation and config through `@bdocs/runtime`, so the
// spies are applied to that module. Everything else in the runtime (the url
// contract helpers the locale switch now uses) stays real — those are the code
// under test.
vi.mock('@bdocs/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bdocs/runtime')>()
  return {
    ...actual,
    useLocation: vi.fn(),
    useNavigate: vi.fn(),
    useConfig: vi.fn(),
  }
})
vi.mock('../src/hooks/use-routes')
vi.mock('../src/store/boltdocs-context')

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
  versions,
}: {
  currentRoute: Route
  allRoutes: Route[]
  currentLocale: string
  currentVersion?: string
  versions?: {
    defaultVersion: string
    versions: { label: string; path: string }[]
    prefix?: string
  }
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
    versions: versions
      ? {
          defaultVersion: versions.defaultVersion,
          prefix: versions.prefix || '',
          versions: versions.versions,
        }
      : undefined,
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

    // The store write is optimistic (the router reads the active locale from
    // the global registry within this same handler); StoreSync reconciles it
    // against the live URL once the navigation lands.
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
      versions: {
        defaultVersion: 'v2',
        versions: [{ label: 'v2', path: 'v2' }],
      },
    })

    const { result } = renderHook(() => useI18n())
    result.current.handleLocaleChange('es')

    expect(setLocale).toHaveBeenCalledWith('es')
    expect(navigate).toHaveBeenCalledWith('/docs/v2/es/guides/getting-started')
  })

  it('is a no-op when the target locale equals the current locale', () => {
    const englishRoute: Route = {
      path: '/docs/guides/getting-started',
      filePath: 'guides/getting-started.mdx',
    }

    configure({
      currentRoute: englishRoute,
      allRoutes: [englishRoute],
      currentLocale: 'en',
    })

    const { result } = renderHook(() => useI18n())
    result.current.handleLocaleChange('en')

    expect(navigate).not.toHaveBeenCalled()
    expect(setLocale).not.toHaveBeenCalled()
  })
})

describe('useI18n collection locale navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('navigates from a Spanish blog post to English (no version prefix)', () => {
    const englishRoute: Route = {
      path: '/docs/blog/boltdocs-3-4-0',
      filePath: '[blog]/boltdocs-3-4-0.mdx',
      collection: 'blog',
    }
    const spanishRoute: Route = {
      path: '/docs/es/blog/boltdocs-3-4-0',
      filePath: 'es/[blog]/boltdocs-3-4-0.mdx',
      locale: 'es',
      collection: 'blog',
    }

    configure({
      currentRoute: spanishRoute,
      allRoutes: [englishRoute, spanishRoute],
      currentLocale: 'es',
    })

    const { result } = renderHook(() => useI18n())
    result.current.handleLocaleChange('en')

    expect(setLocale).toHaveBeenCalledWith('en')
    expect(navigate).toHaveBeenCalledWith('/docs/blog/boltdocs-3-4-0')
  })

  it('navigates from an English blog post to Spanish (no version prefix)', () => {
    const englishRoute: Route = {
      path: '/docs/blog/boltdocs-3-4-0',
      filePath: '[blog]/boltdocs-3-4-0.mdx',
      collection: 'blog',
    }
    const spanishRoute: Route = {
      path: '/docs/es/blog/boltdocs-3-4-0',
      filePath: 'es/[blog]/boltdocs-3-4-0.mdx',
      locale: 'es',
      collection: 'blog',
    }

    configure({
      currentRoute: englishRoute,
      allRoutes: [englishRoute, spanishRoute],
      currentLocale: 'en',
    })

    const { result } = renderHook(() => useI18n())
    result.current.handleLocaleChange('es')

    expect(setLocale).toHaveBeenCalledWith('es')
    expect(navigate).toHaveBeenCalledWith('/docs/es/blog/boltdocs-3-4-0')
  })

  it('preserves version while switching locale on a versioned blog post', () => {
    const englishRoute: Route = {
      path: '/docs/v2/blog/boltdocs-3-4-0',
      filePath: 'v2/[blog]/boltdocs-3-4-0.mdx',
      version: 'v2',
      collection: 'blog',
    }
    const spanishRoute: Route = {
      path: '/docs/v2/es/blog/boltdocs-3-4-0',
      filePath: 'v2/es/[blog]/boltdocs-3-4-0.mdx',
      locale: 'es',
      version: 'v2',
      collection: 'blog',
    }

    configure({
      currentRoute: englishRoute,
      allRoutes: [englishRoute, spanishRoute],
      currentLocale: 'en',
      currentVersion: 'v2',
      versions: {
        defaultVersion: 'v2',
        versions: [{ label: 'v2', path: 'v2' }],
      },
    })

    const { result } = renderHook(() => useI18n())
    result.current.handleLocaleChange('es')

    expect(setLocale).toHaveBeenCalledWith('es')
    expect(navigate).toHaveBeenCalledWith('/docs/v2/es/blog/boltdocs-3-4-0')
  })

  it('navigates from a versioned Spanish blog post to English', () => {
    const englishRoute: Route = {
      path: '/docs/v2/blog/boltdocs-3-4-0',
      filePath: 'v2/[blog]/boltdocs-3-4-0.mdx',
      version: 'v2',
      collection: 'blog',
    }
    const spanishRoute: Route = {
      path: '/docs/v2/es/blog/boltdocs-3-4-0',
      filePath: 'v2/es/[blog]/boltdocs-3-4-0.mdx',
      locale: 'es',
      version: 'v2',
      collection: 'blog',
    }

    configure({
      currentRoute: spanishRoute,
      allRoutes: [englishRoute, spanishRoute],
      currentLocale: 'es',
      currentVersion: 'v2',
      versions: {
        defaultVersion: 'v2',
        versions: [{ label: 'v2', path: 'v2' }],
      },
    })

    const { result } = renderHook(() => useI18n())
    result.current.handleLocaleChange('en')

    expect(setLocale).toHaveBeenCalledWith('en')
    expect(navigate).toHaveBeenCalledWith('/docs/v2/blog/boltdocs-3-4-0')
  })

  it('does not navigate away from collection root page when switching locale', () => {
    const blogRootRoute: Route = {
      path: '/docs/blog',
      filePath: '[blog]/_index.mdx',
      collection: 'blog',
    }

    configure({
      currentRoute: blogRootRoute,
      allRoutes: [blogRootRoute],
      currentLocale: 'en',
    })

    const { result } = renderHook(() => useI18n())
    result.current.handleLocaleChange('es')

    // Collection root pages are locale-independent, should not navigate
    expect(navigate).not.toHaveBeenCalled()
    expect(setLocale).toHaveBeenCalledWith('es')
  })
})
