import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSidebar, hasChildren } from '../../src/client/hooks/use-sidebar'
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

  it("resolves each tab's own meta.json when directories share a name", () => {
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      directoryMeta: {
        '(guides)/content': {
          title: 'Content & MDX',
          order: 2,
        },
        '(plugins)/content': {
          title: 'Content Plugins',
          order: 1,
        },
      },
      theme: {
        tabs: [
          { id: 'guides', text: 'Guides' },
          { id: 'plugins', text: 'Plugins' },
        ],
      },
    } as any)
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/guides/content/intro',
      search: '',
      hash: '',
    })

    const routes = [
      {
        path: '/docs/guides/content/intro',
        filePath: '(guides)/content/intro.md',
        title: 'Introduction',
        tab: 'guides',
        slugParts: ['content'],
      },
      {
        path: '/docs/plugins/content/mermaid',
        filePath: '(plugins)/content/mermaid.md',
        title: 'Mermaid',
        tab: 'plugins',
        slugParts: ['content'],
      },
    ]

    const { result } = renderHook(() => useSidebar(routes as any))

    expect(result.current.groups).toHaveLength(1)
    expect(result.current.groups[0].title).toBe('Content & MDX')
    expect(result.current.groups[0].sidebarPosition).toBe(2)
  })

  it('resolves the localized meta.json for a translated route', () => {
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      directoryMeta: {
        '(guides)/content': { title: 'Content & MDX', order: 2 },
        'es/(guides)/content': { title: 'Contenido y MDX', order: 2 },
      },
      theme: {
        tabs: [{ id: 'guides', text: 'Guides' }],
      },
    } as any)
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/es/guides/content/intro',
      search: '',
      hash: '',
    })

    const routes = [
      {
        path: '/docs/es/guides/content/intro',
        filePath: 'es/(guides)/content/intro.md',
        title: 'Introduction',
        tab: 'guides',
        locale: 'es',
        slugParts: ['content'],
      },
    ]

    const { result } = renderHook(() => useSidebar(routes as any))

    expect(result.current.groups).toHaveLength(1)
    expect(result.current.groups[0].title).toBe('Contenido y MDX')
  })

  it('keeps meta.json order authoritative over the index sidebarPosition', () => {
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      directoryMeta: {
        '(integrations)/seo': { title: 'SEO & Analytics', order: 1 },
        '(integrations)/search': { title: 'Search', order: 2 },
      },
      theme: {
        tabs: [{ id: 'integrations', text: 'Integrations' }],
      },
    } as any)
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/integrations/seo/ga4',
      search: '',
      hash: '',
    })

    const routes = [
      {
        path: '/docs/integrations/seo',
        filePath: '(integrations)/seo/index.md',
        title: 'SEO & Robots',
        tab: 'integrations',
        sidebarPosition: 1,
        slugParts: ['seo'],
      },
      {
        path: '/docs/integrations/seo/ga4',
        filePath: '(integrations)/seo/ga4.md',
        title: 'GA4',
        tab: 'integrations',
        slugParts: ['seo'],
      },
      {
        path: '/docs/integrations/search',
        filePath: '(integrations)/search/index.md',
        title: 'Search',
        tab: 'integrations',
        sidebarPosition: 1,
        slugParts: ['search'],
      },
      {
        path: '/docs/integrations/search/algolia',
        filePath: '(integrations)/search/algolia.md',
        title: 'Algolia',
        tab: 'integrations',
        slugParts: ['search'],
      },
    ]

    const { result } = renderHook(() => useSidebar(routes as any))

    expect(result.current.groups.map((group) => group.title)).toEqual([
      'SEO & Analytics',
      'Search',
    ])
  })

  it('falls back to the default-locale meta when no localized meta exists', () => {
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      directoryMeta: {
        '(guides)/content': { title: 'Content & MDX', order: 2 },
      },
      theme: {
        tabs: [{ id: 'guides', text: 'Guides' }],
      },
    } as any)
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/es/guides/content/intro',
      search: '',
      hash: '',
    })

    const routes = [
      {
        path: '/docs/es/guides/content/intro',
        filePath: 'es/(guides)/content/intro.md',
        title: 'Introduction',
        tab: 'guides',
        locale: 'es',
        slugParts: ['content'],
      },
    ]

    const { result } = renderHook(() => useSidebar(routes as any))

    expect(result.current.groups).toHaveLength(1)
    expect(result.current.groups[0].title).toBe('Content & MDX')
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

  it('exposes merged items, an active tree, and activity helpers', () => {
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      directoryMeta: {},
      theme: {},
    } as any)
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/guides/getting-started/install',
      search: '',
      hash: '',
    })

    const routes = [
      {
        path: '/docs/guides',
        filePath: 'guides/index.md',
        title: 'Guides',
        slugParts: ['guides'],
      },
      {
        path: '/docs/guides/getting-started',
        filePath: 'guides/getting-started/index.md',
        title: 'Getting Started',
        slugParts: ['guides', 'getting-started'],
      },
      {
        path: '/docs/guides/getting-started/install',
        filePath: 'guides/getting-started/install.md',
        title: 'Install',
        slugParts: ['guides', 'getting-started'],
      },
    ]

    const { result } = renderHook(() => useSidebar(routes as any))

    expect(result.current.merged).toHaveLength(1)
    expect(result.current.merged[0]).toMatchObject({
      type: 'group',
      title: 'Guides',
    })
    expect(result.current.groups[0].routes).toHaveLength(1)

    expect(result.current.isActive(routes[2] as any)).toBe(true)
    expect(result.current.isActive(routes[1] as any)).toBe(false)
    expect(result.current.isGroupActive(result.current.groups[0])).toBe(true)

    const root = result.current.tree[0]
    expect(root).toMatchObject({
      isGroup: true,
      depth: 0,
      isActive: true,
      hasChildren: true,
    })
    expect(root.route.title).toBe('Guides')

    const subgroup = root.children[0]
    expect(subgroup).toMatchObject({
      depth: 1,
      isActive: true,
      hasChildren: true,
    })
    expect(subgroup.route.title).toBe('Getting Started')

    const leaf = subgroup.children[0]
    expect(leaf).toMatchObject({ depth: 2, isActive: true, hasChildren: false })
    expect(leaf.route.title).toBe('Install')
  })

  it('hasChildren detects nested routes', () => {
    expect(hasChildren({} as any)).toBe(false)
    expect(hasChildren({ subRoutes: [] } as any)).toBe(false)
    expect(hasChildren({ subRoutes: [{ path: '/x' }] } as any)).toBe(true)
    expect(hasChildren({ routes: [{ path: '/y' }] } as any)).toBe(true)
  })
})
