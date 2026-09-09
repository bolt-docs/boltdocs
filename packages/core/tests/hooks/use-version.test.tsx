import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVersion } from '../../src/client/hooks/use-version'
import { useConfig } from '../../src/client/app/config-context'
import { useRoutes } from '../../src/client/hooks/use-routes'
import { useBoltdocsContext } from '../../src/client/store/boltdocs-context'
import { useNavigate } from '../../src/client/router'

// Mock the dependencies of the hook
vi.mock('../../src/client/router', () => ({
  useNavigate: vi.fn(),
  LocationProvider: ({ children }: any) => children,
  useLocation: vi.fn(() => ({ pathname: '/', search: '', hash: '' })),
  useRouteData: vi.fn(),
  useLoaderData: vi.fn(),
  useMatches: vi.fn(() => []),
  Outlet: () => null,
  OutletContext: null as any,
  RouteRenderer: ({ children }: any) => children,
  matchRouteBranch: vi.fn(() => []),
  resolveRouteBranch: vi.fn(async (b: any) => b),
}))
vi.mock('../../src/client/app/config-context')
vi.mock('../../src/client/hooks/use-routes')
vi.mock('../../src/client/store/boltdocs-context')

describe('useVersion', () => {
  const mockNavigate = vi.fn()
  const mockSetVersion = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useNavigate as any).mockReturnValue(mockNavigate)
    ;(useBoltdocsContext as any).mockReturnValue({
      setVersion: mockSetVersion,
    })
  })

  it('should return available versions when configuration is fully specified', () => {
    ;(useConfig as any).mockReturnValue({
      versions: {
        defaultVersion: 'v1',
        versions: [
          { label: 'Version 1', path: 'v1' },
          { label: 'Version 2', path: 'v2' },
        ],
      },
    })
    ;(useRoutes as any).mockReturnValue({
      allRoutes: [],
      currentRoute: null,
      currentVersion: 'v1',
      currentLocale: undefined,
    })

    const { result } = renderHook(() => useVersion())
    const { availableVersions, currentVersion, currentVersionLabel } =
      result.current

    expect(currentVersion).toBe('v1')
    expect(currentVersionLabel).toBe('Version 1')
    expect(availableVersions).toHaveLength(2)
    expect(availableVersions[0]).toEqual({
      key: 'v1',
      label: 'Version 1',
      value: 'v1',
      isCurrent: true,
    })
    expect(availableVersions[1]).toEqual({
      key: 'v2',
      label: 'Version 2',
      value: 'v2',
      isCurrent: false,
    })
  })

  it('should NOT crash and return empty available versions if config.versions has missing versions array', () => {
    // Edge case: config.versions is defined but config.versions.versions is missing/undefined
    ;(useConfig as any).mockReturnValue({
      versions: {
        defaultVersion: 'v1',
      } as any,
    })
    ;(useRoutes as any).mockReturnValue({
      allRoutes: [],
      currentRoute: null,
      currentVersion: 'v1',
      currentLocale: undefined,
    })

    const { result } = renderHook(() => useVersion())
    const { availableVersions, currentVersionLabel } = result.current

    expect(currentVersionLabel).toBe('v1')
    expect(availableVersions).toEqual([])
  })

  it('should NOT crash and return empty available versions if config.versions is entirely undefined', () => {
    ;(useConfig as any).mockReturnValue({})
    ;(useRoutes as any).mockReturnValue({
      allRoutes: [],
      currentRoute: null,
      currentVersion: undefined,
      currentLocale: undefined,
    })

    const { result } = renderHook(() => useVersion())
    const { availableVersions, currentVersion, currentVersionLabel } =
      result.current

    expect(currentVersion).toBeUndefined()
    expect(currentVersionLabel).toBeUndefined()
    expect(availableVersions).toEqual([])
  })

  it('should preserve the active locale when changing versions', () => {
    ;(useConfig as any).mockReturnValue({
      base: '/docs',
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'English', es: 'Spanish' },
      },
      versions: {
        defaultVersion: 'v1',
        versions: [
          { label: 'Version 1', path: 'v1' },
          { label: 'Version 2', path: 'v2' },
        ],
      },
    })
    ;(useRoutes as any).mockReturnValue({
      allRoutes: [
        {
          path: '/docs/v2/es/guides/intro',
          filePath: 'v2/es/guides/intro.md',
          version: 'v2',
          locale: 'es',
        },
      ],
      currentRoute: {
        path: '/docs/v1/es/guides/intro',
        filePath: 'v1/es/guides/intro.md',
        version: 'v1',
        locale: 'es',
      },
      currentVersion: 'v1',
      currentLocale: 'es',
    })

    const { result } = renderHook(() => useVersion())

    act(() => {
      result.current.handleVersionChange('v2')
    })

    expect(mockSetVersion).toHaveBeenCalledWith('v2')
    expect(mockNavigate).toHaveBeenCalledWith('/docs/v2/es/guides/intro')
  })

  it('should navigate to the correct target version path on version change', () => {
    ;(useConfig as any).mockReturnValue({
      base: '/docs',
      versions: {
        defaultVersion: 'v1',
        versions: [
          { label: 'Version 1', path: 'v1' },
          { label: 'Version 2', path: 'v2' },
        ],
      },
    })
    ;(useRoutes as any).mockReturnValue({
      allRoutes: [
        {
          path: '/docs/v2/guides/intro',
          filePath: 'guides/intro.md',
          version: 'v2',
        },
      ],
      currentRoute: {
        path: '/docs/v1/guides/intro',
        filePath: 'guides/intro.md',
        version: 'v1',
      },
      currentVersion: 'v1',
      currentLocale: undefined,
    })

    const { result } = renderHook(() => useVersion())

    act(() => {
      result.current.handleVersionChange('v2')
    })

    expect(mockSetVersion).toHaveBeenCalledWith('v2')
    expect(mockNavigate).toHaveBeenCalledWith('/docs/v2/guides/intro')
  })
})
