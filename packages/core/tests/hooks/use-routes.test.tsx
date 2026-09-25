import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type * as React from 'react'
import { useRoutes } from '../../src/client/hooks/use-routes'
import { useLocation } from '../../src/client/router'
import { useConfig } from '../../src/client/app/config-context'
import { useRoutesContext } from '../../src/client/app/routes-context'
import { useBoltdocsContext } from '../../src/client/store/boltdocs-context'
import type { BoltdocsConfig, ComponentRoute } from '../../src/client/types'

vi.mock('../../src/client/router', async () => {
  const actual = await vi.importActual('../../src/client/router')
  return {
    ...actual,
    useLocation: vi.fn(() => ({
      pathname: '/docs',
      search: '',
      hash: '',
    })),
  }
})

vi.mock('../../src/client/app/config-context', () => ({
  useConfig: vi.fn(() => ({})),
}))

vi.mock('../../src/client/app/routes-context', () => ({
  useRoutesContext: vi.fn(),
}))

vi.mock('../../src/client/store/boltdocs-context', () => ({
  useBoltdocsContext: vi.fn(() => ({
    hasHydrated: true,
    currentLocale: '',
    currentVersion: '',
    setLocale: vi.fn(),
    setVersion: vi.fn(),
    setHasHydrated: vi.fn(),
  })),
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
)

function route(
  path: string,
  overrides: Partial<ComponentRoute> = {},
): ComponentRoute {
  return {
    path,
    componentPath: `/project/docs${path}.mdx`,
    filePath: `${path.slice(1)}.mdx`,
    title: path,
    ...overrides,
  }
}

function routeIndex(routes: ComponentRoute[]) {
  const byPath = new Map(routes.map((item) => [item.path, item]))
  const hintsByPath = new Map(
    routes.map((item) => [
      item.path,
      {
        path: item.path,
        kind: item.collection ? ('collection' as const) : undefined,
        collection: item.collection,
      },
    ]),
  )
  const byCollectionPath = new Map<string, ComponentRoute[]>()
  for (const item of routes) {
    if (!item.collection) continue
    const parts = item.path.split('/').filter(Boolean)
    const collectionIndex = parts.indexOf(item.collection)
    const key = `/${parts.slice(collectionIndex).join('/')}`
    const candidates = byCollectionPath.get(key) || []
    candidates.push(item)
    byCollectionPath.set(key, candidates)
  }

  return {
    byPath,
    hintsByPath,
    byCollectionPath,
    collectionNames: [
      ...new Set(
        routes.flatMap((item) => (item.collection ? [item.collection] : [])),
      ),
    ],
  }
}

function setRouteState(options: {
  routes: ComponentRoute[]
  pathname?: string
  config?: BoltdocsConfig
  currentLocale?: string
  currentVersion?: string
}) {
  vi.mocked(useLocation).mockReturnValue({
    pathname: options.pathname || '/docs',
    search: '',
    hash: '',
  })
  vi.mocked(useConfig).mockReturnValue(options.config || {})
  vi.mocked(useRoutesContext).mockReturnValue({
    routes: options.routes,
    index: routeIndex(options.routes),
  })
  vi.mocked(useBoltdocsContext).mockReturnValue({
    hasHydrated: true,
    currentLocale: options.currentLocale || '',
    currentVersion: options.currentVersion || '',
    setLocale: vi.fn(),
    setVersion: vi.fn(),
    setHasHydrated: vi.fn(),
  })
}

const i18n = {
  defaultLocale: 'en',
  locales: { en: 'English', es: 'Español' },
}
const versions = {
  defaultVersion: 'v1',
  versions: [
    { label: 'v1', path: 'v1' },
    { label: 'v2', path: 'v2' },
  ],
}

describe('useRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns and resolves all routes when i18n and versions are disabled', () => {
    const routes = [route('/docs'), route('/docs/guide')]
    setRouteState({ routes, pathname: '/docs/' })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.allRoutes).toBe(routes)
    expect(result.current.routes).toEqual(routes)
    expect(result.current.currentRoute).toBe(routes[0])
    expect(result.current.currentLocale).toBeUndefined()
    expect(result.current.currentVersion).toBeUndefined()
    expect(result.current.isCollectionPage).toBe(false)
  })

  it.each([
    { locales: ['en', 'es'], pathname: '/es/docs', locale: 'es' },
    {
      locales: { en: 'English', es: 'Español' },
      pathname: '/es/docs/',
      locale: 'es',
    },
  ])('resolves the structural locale for $pathname and filters its routes', ({
    locales,
    pathname,
    locale,
  }) => {
    const routes = [
      route('/docs', { locale: 'en' }),
      route('/es/docs', { locale: 'es' }),
      route('/docs/guide', { locale: 'en' }),
      route('/es/docs/guia', { locale: 'es' }),
    ]
    setRouteState({
      routes,
      pathname,
      config: { base: '/docs', i18n: { defaultLocale: 'en', locales } },
      currentLocale: 'en',
    })

    const { result } = renderHook(() => useRoutes(), {
      wrapper: TestWrapper,
    })

    expect(result.current.currentLocale).toBe(locale)
    expect(result.current.currentRoute?.locale).toBe(locale)
    expect(result.current.routes.map((item) => item.locale)).toEqual([
      locale,
      locale,
    ])
  })

  it('does not mistake a nested content segment for a locale or version', () => {
    const routes = [route('/docs/guides/en/overview', { locale: 'en' })]
    setRouteState({
      routes,
      pathname: '/docs/guides/en/overview',
      config: {
        base: '/docs',
        i18n,
        versions: { ...versions, prefix: 'releases/' },
      },
      currentLocale: 'en',
      currentVersion: 'v1',
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentLocale).toBe('en')
    expect(result.current.currentVersion).toBe('v1')
    expect(result.current.routes).toEqual(routes)
  })

  it('resolves a configured version prefix before the locale', () => {
    const routes = [
      route('/docs/releases/v2/es/guides/start', {
        locale: 'es',
        version: 'v2',
      }),
    ]
    setRouteState({
      routes,
      pathname: '/docs/releases/v2/es/guides/start/',
      config: {
        base: '/docs',
        i18n,
        versions: {
          defaultVersion: 'v1',
          prefix: 'releases/',
          versions: versions.versions,
        },
      },
      currentLocale: 'en',
      currentVersion: 'v1',
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentLocale).toBe('es')
    expect(result.current.currentVersion).toBe('v2')
    expect(result.current.currentRoute).toBe(routes[0])
    expect(result.current.routes).toEqual(routes)
  })

  it('resolves a textual version prefix in a single URL segment', () => {
    const routes = [
      route('/docs/v1/guides/start', {
        version: '1',
      }),
    ]
    setRouteState({
      routes,
      pathname: '/docs/v1/guides/start',
      config: {
        base: '/docs',
        i18n,
        versions: {
          defaultVersion: '1',
          prefix: 'v',
          versions: [{ label: 'v1', path: '1' }],
        },
      },
      currentLocale: 'en',
      currentVersion: '1',
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentVersion).toBe('1')
    expect(result.current.currentRoute).toBe(routes[0])
  })

  it('falls back to configured defaults for unknown store preferences', () => {
    setRouteState({
      routes: [route('/docs')],
      config: { base: '/docs', i18n, versions },
      currentLocale: 'fr',
      currentVersion: 'v9',
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentLocale).toBe('en')
    expect(result.current.currentVersion).toBe('v1')
  })

  it('selects matching alternates from the locale/version route matrix', () => {
    const routes = [
      route('/docs/intro', { filePath: 'intro.en.v1.mdx' }),
      route('/es/docs/intro', {
        filePath: 'intro.en.v1.mdx',
        locale: 'es',
      }),
      route('/docs/v2/intro', {
        filePath: 'intro.en.v1.mdx',
        version: 'v2',
      }),
      route('/docs/v2/es/intro', {
        filePath: 'intro.en.v1.mdx',
        locale: 'es',
        version: 'v2',
      }),
    ]
    setRouteState({
      routes,
      pathname: '/docs/v2/es/intro',
      config: { base: '/docs', i18n, versions },
      currentLocale: 'es',
      currentVersion: 'v2',
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentRoute).toBe(routes[3])
    expect(result.current.routes).toEqual([routes[3]])
  })

  it('resolves collection routes by exact structural path under the base', () => {
    const post = route('/blog/boltdocs-3.3.0', {
      collection: 'blog',
      locale: 'es',
    })
    const regularPage = route('/docs/guides/boltdocs-3.3.0')
    setRouteState({
      routes: [post, regularPage],
      pathname: '/docs/es/blog/boltdocs-3.3.0',
      config: { base: '/docs', i18n },
      currentLocale: 'en',
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentRoute).toBe(post)
    expect(result.current.isCollectionPage).toBe(true)
  })

  it('does not use a collection route as an arbitrary pathname tail match', () => {
    const post = route('/blog/shared', { collection: 'blog' })
    setRouteState({
      routes: [post],
      pathname: '/docs/guides/shared',
      config: { base: '/docs' },
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentRoute).toBeUndefined()
    expect(result.current.isCollectionPage).toBe(false)
  })

  it('resolves localized and versioned collection variants exactly', () => {
    const english = route('/blog/post', { collection: 'blog' })
    const spanish = route('/es/blog/post', { collection: 'blog', locale: 'es' })
    const versionTwo = route('/v2/es/blog/post', {
      collection: 'blog',
      locale: 'es',
      version: 'v2',
    })
    setRouteState({
      routes: [english, spanish, versionTwo],
      pathname: '/docs/releases/v2/es/blog/post',
      config: {
        base: '/docs',
        i18n,
        versions: { ...versions, prefix: 'releases/' },
      },
      currentLocale: 'es',
      currentVersion: 'v2',
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentRoute).toBe(versionTwo)
    expect(result.current.isCollectionPage).toBe(true)
  })

  it('recognizes collection listings structurally, including pagination', () => {
    const index = route('/blog', { collection: 'blog' })
    setRouteState({
      routes: [index, route('/docs/guides/blog')],
      pathname: '/docs/blog/page/2',
      config: { base: '/docs' },
    })

    const { result } = renderHook(() => useRoutes(), { wrapper: TestWrapper })

    expect(result.current.currentRoute).toBeUndefined()
    expect(result.current.isCollectionPage).toBe(true)
  })

  it('returns the same route result on an unrelated rerender', () => {
    const routes = [route('/docs')]
    setRouteState({ routes })
    const { result, rerender } = renderHook(() => useRoutes(), {
      wrapper: TestWrapper,
    })
    const firstRoutes = result.current.routes
    const firstRoute = result.current.currentRoute

    rerender()

    expect(result.current.routes).toBe(firstRoutes)
    expect(result.current.currentRoute).toBe(firstRoute)
  })
})
