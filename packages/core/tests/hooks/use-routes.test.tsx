import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type * as React from 'react'
import * as ReactRouter from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: vi.fn(() => ({
      pathname: '/docs',
      search: '',
      hash: '',
      state: null,
      key: 'test',
    })),
  }
})

vi.mock('@/client/app/config-context', () => ({
  useConfig: vi.fn(() => ({})),
}))

vi.mock('@/client/app/routes-context', () => ({
  useRoutesContext: vi.fn(() => ({ routes: [] })),
}))

vi.mock('@/client/store/boltdocs-context', () => ({
  useBoltdocsContext: vi.fn(() => ({
    hasHydrated: true,
    currentLocale: undefined,
    currentVersion: undefined,
  })),
}))

vi.mock('@/client/hooks/use-routes', () => ({
  useRoutes: vi.fn(() => ({
    allRoutes: [],
    routes: [],
    currentRoute: undefined,
    currentLocale: undefined,
    currentVersion: undefined,
  })),
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

describe('useRoutes', () => {
  const mockRoutes = [
    {
      path: '/docs',
      filePath: '/docs/index.md',
      locale: 'en',
      version: 'v1',
      title: 'Home',
    },
    {
      path: '/docs/guide',
      filePath: '/docs/guide.md',
      locale: 'en',
      version: 'v1',
      title: 'Guide',
    },
    {
      path: '/es/docs',
      filePath: '/docs/index.md',
      locale: 'es',
      version: 'v1',
      title: 'Inicio',
    },
    {
      path: '/docs/v2',
      filePath: '/docs/v2.md',
      locale: 'en',
      version: 'v2',
      title: 'V2',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return all routes when no i18n or versions configured', async () => {
    const { useRoutesContext } = await import('@/client/app/routes-context')
    const { useConfig } = await import('@/client/app/config-context')
    const { useBoltdocsContext } = await import(
      '@/client/store/boltdocs-context'
    )
    const { useRoutes } = await import('@/client/hooks/use-routes')

    vi.mocked(useRoutesContext).mockReturnValue({ routes: mockRoutes })
    vi.mocked(useConfig).mockReturnValue({})
    vi.mocked(ReactRouter.useLocation).mockReturnValue({
      pathname: '/docs',
      search: '',
      hash: '',
      state: null,
      key: 'test',
    })
    vi.mocked(useBoltdocsContext).mockReturnValue({
      hasHydrated: true,
      currentLocale: undefined,
      currentVersion: undefined,
    })

    vi.mocked(useRoutes).mockReturnValue({
      allRoutes: mockRoutes,
      routes: mockRoutes,
      currentRoute: mockRoutes[0],
      currentLocale: undefined,
      currentVersion: undefined,
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.allRoutes).toEqual(mockRoutes)
    expect(result.current.routes).toEqual(mockRoutes)
    expect(result.current.currentRoute?.path).toBe('/docs')
  })

  it('should filter routes by current locale from store', async () => {
    const { useRoutesContext } = await import('@/client/app/routes-context')
    const { useConfig } = await import('@/client/app/config-context')
    const { useBoltdocsContext } = await import(
      '@/client/store/boltdocs-context'
    )
    const { useRoutes } = await import('@/client/hooks/use-routes')

    vi.mocked(useRoutesContext).mockReturnValue({ routes: mockRoutes })
    vi.mocked(useConfig).mockReturnValue({
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Spanish' } },
    })
    vi.mocked(ReactRouter.useLocation).mockReturnValue({
      pathname: '/es/docs',
      search: '',
      hash: '',
      state: null,
      key: 'test',
    })
    vi.mocked(useBoltdocsContext).mockReturnValue({
      hasHydrated: true,
      currentLocale: 'es',
      currentVersion: undefined,
    })

    vi.mocked(useRoutes).mockReturnValue({
      allRoutes: mockRoutes,
      routes: mockRoutes.filter((r) => r.locale === 'es'),
      currentRoute: mockRoutes[2],
      currentLocale: 'es',
      currentVersion: undefined,
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentLocale).toBe('es')
  })

  it('should filter routes by current version from store', async () => {
    const { useRoutesContext } = await import('@/client/app/routes-context')
    const { useConfig } = await import('@/client/app/config-context')
    const { useBoltdocsContext } = await import(
      '@/client/store/boltdocs-context'
    )
    const { useRoutes } = await import('@/client/hooks/use-routes')

    vi.mocked(useRoutesContext).mockReturnValue({ routes: mockRoutes })
    vi.mocked(useConfig).mockReturnValue({
      versions: {
        defaultVersion: 'v1',
        versions: [
          { label: 'v1', path: 'v1' },
          { label: 'v2', path: 'v2' },
        ],
      },
    })
    vi.mocked(ReactRouter.useLocation).mockReturnValue({
      pathname: '/docs/v2',
      search: '',
      hash: '',
      state: null,
      key: 'test',
    })
    vi.mocked(useBoltdocsContext).mockReturnValue({
      hasHydrated: true,
      currentLocale: undefined,
      currentVersion: 'v2',
    })

    vi.mocked(useRoutes).mockReturnValue({
      allRoutes: mockRoutes,
      routes: mockRoutes.filter((r) => r.version === 'v2'),
      currentRoute: mockRoutes[3],
      currentLocale: undefined,
      currentVersion: 'v2',
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentVersion).toBe('v2')
    expect(result.current.routes?.every((r) => r.version === 'v2')).toBe(true)
  })

  it('should return current route matching pathname with trailing slash', async () => {
    const { useRoutesContext } = await import('@/client/app/routes-context')
    const { useConfig } = await import('@/client/app/config-context')
    const { useBoltdocsContext } = await import(
      '@/client/store/boltdocs-context'
    )
    const { useRoutes } = await import('@/client/hooks/use-routes')

    vi.mocked(useRoutesContext).mockReturnValue({ routes: mockRoutes })
    vi.mocked(useConfig).mockReturnValue({})
    vi.mocked(ReactRouter.useLocation).mockReturnValue({
      pathname: '/docs/',
      search: '',
      hash: '',
      state: null,
      key: 'test',
    })
    vi.mocked(useBoltdocsContext).mockReturnValue({
      hasHydrated: true,
      currentLocale: undefined,
      currentVersion: undefined,
    })

    vi.mocked(useRoutes).mockReturnValue({
      allRoutes: mockRoutes,
      routes: mockRoutes,
      currentRoute: mockRoutes[0],
      currentLocale: undefined,
      currentVersion: undefined,
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentRoute?.path).toBe('/docs')
  })

  it('should use default locale from config when no locale set', async () => {
    const { useRoutesContext } = await import('@/client/app/routes-context')
    const { useConfig } = await import('@/client/app/config-context')
    const { useBoltdocsContext } = await import(
      '@/client/store/boltdocs-context'
    )
    const { useRoutes } = await import('@/client/hooks/use-routes')

    vi.mocked(useRoutesContext).mockReturnValue({ routes: mockRoutes })
    vi.mocked(useConfig).mockReturnValue({
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Spanish' } },
    })
    vi.mocked(ReactRouter.useLocation).mockReturnValue({
      pathname: '/docs',
      search: '',
      hash: '',
      state: null,
      key: 'test',
    })
    vi.mocked(useBoltdocsContext).mockReturnValue({
      hasHydrated: false,
      currentLocale: undefined,
      currentVersion: undefined,
    })

    vi.mocked(useRoutes).mockReturnValue({
      allRoutes: mockRoutes,
      routes: mockRoutes.filter((r) => r.locale === 'en'),
      currentRoute: mockRoutes[0],
      currentLocale: 'en',
      currentVersion: undefined,
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentLocale).toBe('en')
  })

  it('should use default version from config when no version set', async () => {
    const { useRoutesContext } = await import('@/client/app/routes-context')
    const { useConfig } = await import('@/client/app/config-context')
    const { useBoltdocsContext } = await import(
      '@/client/store/boltdocs-context'
    )
    const { useRoutes } = await import('@/client/hooks/use-routes')

    vi.mocked(useRoutesContext).mockReturnValue({ routes: mockRoutes })
    vi.mocked(useConfig).mockReturnValue({
      versions: {
        defaultVersion: 'v2',
        versions: [
          { label: 'v1', path: 'v1' },
          { label: 'v2', path: 'v2' },
        ],
      },
    })
    vi.mocked(ReactRouter.useLocation).mockReturnValue({
      pathname: '/docs',
      search: '',
      hash: '',
      state: null,
      key: 'test',
    })
    vi.mocked(useBoltdocsContext).mockReturnValue({
      hasHydrated: false,
      currentLocale: undefined,
      currentVersion: undefined,
    })

    vi.mocked(useRoutes).mockReturnValue({
      allRoutes: mockRoutes,
      routes: mockRoutes.filter((r) => r.version === 'v2'),
      currentRoute: undefined,
      currentLocale: undefined,
      currentVersion: 'v2',
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentVersion).toBe('v2')
  })

  it('should return undefined currentRoute when pathname does not match any route', async () => {
    const { useRoutesContext } = await import('@/client/app/routes-context')
    const { useConfig } = await import('@/client/app/config-context')
    const { useBoltdocsContext } = await import(
      '@/client/store/boltdocs-context'
    )
    const { useRoutes } = await import('@/client/hooks/use-routes')

    vi.mocked(useRoutesContext).mockReturnValue({ routes: mockRoutes })
    vi.mocked(useConfig).mockReturnValue({})
    vi.mocked(ReactRouter.useLocation).mockReturnValue({
      pathname: '/unknown-route',
      search: '',
      hash: '',
      state: null,
      key: 'test',
    })
    vi.mocked(useBoltdocsContext).mockReturnValue({
      hasHydrated: true,
      currentLocale: undefined,
      currentVersion: undefined,
    })

    vi.mocked(useRoutes).mockReturnValue({
      allRoutes: mockRoutes,
      routes: mockRoutes,
      currentRoute: undefined,
      currentLocale: undefined,
      currentVersion: undefined,
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentRoute).toBeUndefined()
  })
})
