import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRoutes } from '../../src/client/hooks/use-routes'
import { useLocation } from '../../src/client/router'
import { useConfig } from '../../src/client/app/config-context'
import {
  useRoutesContext,
  type RouteIndex,
} from '../../src/client/app/routes-context'
import { useBoltdocsContext } from '../../src/client/store/boltdocs-context'

vi.mock('../../src/client/router', async () => {
  const actual = await vi.importActual('../../src/client/router')
  return {
    ...actual,
    useLocation: vi.fn(() => ({
      pathname: '/docs/blog/boltdocs-3.3.0',
      search: '',
      hash: '',
    })),
  }
})

vi.mock('../../src/client/app/config-context', () => ({
  useConfig: vi.fn(() => ({
    base: '/docs',
    i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
  })),
}))

vi.mock('../../src/client/app/routes-context', async () => {
  const actual = await vi.importActual('../../src/client/app/routes-context')
  return {
    ...actual,
    useRoutesContext: vi.fn(),
  }
})

vi.mock('../../src/client/store/boltdocs-context', () => ({
  useBoltdocsContext: vi.fn(() => ({
    hasHydrated: true,
    currentLocale: undefined,
    currentVersion: undefined,
  })),
}))

const baseRoutes = [
  {
    path: '/blog/boltdocs-3.3.0',
    componentPath: '/project/docs/[blog]/boltdocs-3.3.0.mdx',
    filePath: '[blog]/boltdocs-3.3.0.mdx',
    title: 'Boltdocs 3.3.0',
    collection: 'blog',
  },
  {
    path: '/docs/api/hooks/use-config',
    componentPath: '/project/docs/(api)/hooks/use-config.mdx',
    filePath: '(api)/hooks/use-config.mdx',
    title: 'useConfig',
  },
]

const mockRoutesContext = (routes: typeof baseRoutes) => {
  const index: RouteIndex = {
    byPath: new Map(routes.map((route) => [route.path, route])),
    hintsByPath: new Map(),
    collectionNames: ['blog'],
  }
  vi.mocked(useRoutesContext).mockReturnValue({ routes, index })
}

describe('useRoutes collection detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'English', es: 'Español' },
      },
    })
    vi.mocked(useBoltdocsContext).mockReturnValue({
      hasHydrated: true,
      currentLocale: undefined,
      currentVersion: undefined,
    })
  })

  it('detects a collection post page even when the route index path lacks the docs base', () => {
    // Collection post routes are registered as `/blog/...` while the browser
    // URL is `/docs/blog/...`, so the route index lookup misses and the
    // collection segment must drive the detection.
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/blog/boltdocs-3.3.0',
      search: '',
      hash: '',
    })
    mockRoutesContext(baseRoutes)

    const { result } = renderHook(() => useRoutes())

    expect(result.current.currentRoute).toBe(baseRoutes[0])
    expect(result.current.isCollectionPage).toBe(true)
  })

  it('detects a localized collection post page', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/es/blog/boltdocs-3.2.0',
      search: '',
      hash: '',
    })
    mockRoutesContext(baseRoutes)

    const { result } = renderHook(() => useRoutes())

    expect(result.current.isCollectionPage).toBe(true)
  })

  it('keeps regular doc pages out of the collection layout', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/api/hooks/use-config',
      search: '',
      hash: '',
    })
    mockRoutesContext(baseRoutes)

    const { result } = renderHook(() => useRoutes())

    expect(result.current.isCollectionPage).toBe(false)
  })
})
