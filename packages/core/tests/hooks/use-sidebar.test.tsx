import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSidebar } from '../../src/client/hooks/use-sidebar'
import { useConfig } from '../../src/client/app/config-context'
import { useLocation } from '../../src/client/router'

vi.mock('../../src/client/router', () => ({
  useLocation: vi.fn(),
  parseUrlReference: (pathname: string) => ({
    routePath: pathname === '/docs' || pathname === '/docs/es' ? '/' : pathname,
  }),
}))

vi.mock('../../src/client/app/config-context')

describe('useSidebar', () => {
  beforeEach(() => {
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      directoryMeta: {},
      theme: {
        tabs: [
          { id: 'guides', text: 'Guides' },
          { id: 'api', text: 'API' },
        ],
      },
    } as any)
  })

  it('filters to the first tab when the docs root has no tab metadata', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs',
      search: '',
      hash: '',
    })

    const routes = [
      {
        path: '/docs/guides',
        filePath: 'guides/index.md',
        title: 'Guides',
        tab: 'guides',
        slugParts: ['guides'],
      },
      {
        path: '/docs/api',
        filePath: 'api/index.md',
        title: 'API',
        tab: 'api',
        slugParts: ['api'],
      },
      {
        path: '/docs/guides/intro',
        filePath: 'guides/intro.md',
        title: 'Introduction',
        tab: 'guides',
        slugParts: ['guides'],
      },
    ]

    const { result } = renderHook(() => useSidebar(routes as any))

    expect(result.current.groups).toHaveLength(1)
    expect(result.current.groups[0].title).toBe('Guides')
  })

  it('uses the first configured tab for a localized docs root fallback', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/es',
      search: '',
      hash: '',
    })

    const routes = [
      {
        path: '/docs/guides',
        filePath: 'guides/index.md',
        title: 'Guides',
        tab: 'guides',
        slugParts: ['guides'],
      },
      {
        path: '/docs/api',
        filePath: 'api/index.md',
        title: 'API',
        tab: 'api',
        slugParts: ['api'],
      },
      {
        path: '/docs/guides/intro',
        filePath: 'guides/intro.md',
        title: 'Introduction',
        tab: 'guides',
        slugParts: ['guides'],
      },
    ]

    const { result } = renderHook(() => useSidebar(routes as any))

    expect(result.current.groups).toHaveLength(1)
    expect(result.current.groups[0].title).toBe('Guides')
  })

  it('shows all routes when tabs are omitted from the theme config', () => {
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      directoryMeta: {},
      theme: {},
    } as any)
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/guides/intro',
      search: '',
      hash: '',
    })

    const routes = [
      {
        path: '/docs/guides/intro',
        filePath: 'guides/intro.md',
        title: 'Introduction',
        slugParts: ['guides'],
      },
      {
        path: '/docs/api/reference',
        filePath: 'api/reference.md',
        title: 'Reference',
        slugParts: ['api'],
      },
    ]

    const { result } = renderHook(() => useSidebar(routes as any))

    expect(result.current.groups).toHaveLength(2)
    expect(result.current.groups.map((group) => group.title)).toEqual([
      'Api',
      'Guides',
    ])
  })

  it('keeps only the active tab on a concrete tab route', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/api/reference',
      search: '',
      hash: '',
    })

    const routes = [
      {
        path: '/docs/guides',
        filePath: 'guides/index.md',
        title: 'Guides',
        tab: 'guides',
        slugParts: ['guides'],
      },
      {
        path: '/docs/api',
        filePath: 'api/index.md',
        title: 'API',
        tab: 'api',
        slugParts: ['api'],
      },
      {
        path: '/docs/api/reference',
        filePath: 'api/reference.md',
        title: 'Reference',
        tab: 'api',
        slugParts: ['api'],
      },
    ]

    const { result } = renderHook(() => useSidebar(routes as any))

    expect(result.current.groups).toHaveLength(1)
    expect(result.current.groups[0].title).toBe('API')
    expect(result.current.groups[0].routes).toHaveLength(1)
    expect(result.current.groups[0].routes[0].title).toBe('Reference')
  })
})
