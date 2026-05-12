import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  useRoutesContext,
  RoutesProvider,
} from '../../src/client/app/routes-context'
import type { ComponentRoute } from '../../src/client/types'
import * as React from 'react'

const mockRoutes: ComponentRoute[] = [
  {
    path: '/docs',
    filePath: '/docs/index.md',
    title: 'Home',
    locale: 'en',
    version: 'v1',
  },
  {
    path: '/docs/guide',
    filePath: '/docs/guide.md',
    title: 'Guide',
    locale: 'en',
    version: 'v1',
  },
  {
    path: '/es/docs',
    filePath: '/docs/index.md',
    title: 'Inicio',
    locale: 'es',
    version: 'v1',
  },
]

const TestRoutesComponent = () => {
  const { routes } = useRoutesContext()
  return <div data-testid="routes-count">{routes.length}</div>
}

const TestRoutesPathComponent = () => {
  const { routes } = useRoutesContext()
  const paths = routes.map((r) => r.path).join(',')
  return <div data-testid="routes-paths">{paths}</div>
}

describe('RoutesContext', () => {
  it('should provide routes to child components', () => {
    render(
      <RoutesProvider routes={mockRoutes}>
        <TestRoutesComponent />
      </RoutesProvider>,
    )
    expect(screen.getByTestId('routes-count').textContent).toBe('3')
  })

  it('should expose correct route paths', () => {
    render(
      <RoutesProvider routes={mockRoutes}>
        <TestRoutesPathComponent />
      </RoutesProvider>,
    )
    expect(screen.getByTestId('routes-paths').textContent).toBe(
      '/docs,/docs/guide,/es/docs',
    )
  })

  it('should provide empty array by default', () => {
    const EmptyTestComponent = () => {
      const { routes } = useRoutesContext()
      return (
        <div data-testid="routes-empty">
          {routes.length === 0 ? 'empty' : 'not-empty'}
        </div>
      )
    }
    render(
      <RoutesProvider routes={[]}>
        <EmptyTestComponent />
      </RoutesProvider>,
    )
    expect(screen.getByTestId('routes-empty').textContent).toBe('empty')
  })

  it('should handle routes with descriptions', () => {
    const routesWithDesc: ComponentRoute[] = [
      {
        path: '/docs',
        filePath: '/docs/index.md',
        title: 'Home',
        description: 'Main page',
        locale: 'en',
        version: 'v1',
      },
    ]
    const TestComponent = () => {
      const { routes } = useRoutesContext()
      return (
        <div data-testid="route-desc">
          {routes[0]?.description || 'no-desc'}
        </div>
      )
    }
    render(
      <RoutesProvider routes={routesWithDesc}>
        <TestComponent />
      </RoutesProvider>,
    )
    expect(screen.getByTestId('route-desc').textContent).toBe('Main page')
  })

  it('should handle routes with groupTitle', () => {
    const routesWithGroup: ComponentRoute[] = [
      {
        path: '/docs',
        filePath: '/docs/index.md',
        title: 'Home',
        groupTitle: 'Getting Started',
        locale: 'en',
        version: 'v1',
      },
    ]
    const TestComponent = () => {
      const { routes } = useRoutesContext()
      return (
        <div data-testid="route-group">
          {routes[0]?.groupTitle || 'no-group'}
        </div>
      )
    }
    render(
      <RoutesProvider routes={routesWithGroup}>
        <TestComponent />
      </RoutesProvider>,
    )
    expect(screen.getByTestId('route-group').textContent).toBe(
      'Getting Started',
    )
  })

  it('should handle routes with locale and version', () => {
    const multiLocaleRoutes: ComponentRoute[] = [
      {
        path: '/en/docs',
        filePath: '/en/docs.md',
        title: 'English',
        locale: 'en',
        version: 'v1',
      },
      {
        path: '/es/docs',
        filePath: '/es/docs.md',
        title: 'Español',
        locale: 'es',
        version: 'v1',
      },
      {
        path: '/v2/docs',
        filePath: '/v2/docs.md',
        title: 'V2 Docs',
        locale: 'en',
        version: 'v2',
      },
    ]
    const TestComponent = () => {
      const { routes } = useRoutesContext()
      return (
        <div data-testid="locale-version">
          {routes.map((r) => `${r.locale}:${r.version}`).join(',')}
        </div>
      )
    }
    render(
      <RoutesProvider routes={multiLocaleRoutes}>
        <TestComponent />
      </RoutesProvider>,
    )
    expect(screen.getByTestId('locale-version').textContent).toBe(
      'en:v1,es:v1,en:v2',
    )
  })
})
