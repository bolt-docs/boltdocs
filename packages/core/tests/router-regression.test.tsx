import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RouteRenderer,
  resolveRouteBranch,
  useNavigate,
  usePrefetch,
} from '../src/client/router'
import type { RouteRecord } from '../src/client/router'

function PrefetchButton({ to }: { to: string }) {
  const prefetch = usePrefetch()
  return (
    <button type="button" onClick={() => void prefetch(to)}>
      Prefetch
    </button>
  )
}

function NavigationButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(to)}>
      {label}
    </button>
  )
}

describe('router navigation regressions', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.history.replaceState({}, '', '/')
  })

  it('deduplicates concurrent lazy imports and retries rejected imports', async () => {
    let resolveImport: ((value: { Component: () => null }) => void) | undefined
    let attempts = 0
    const route: RouteRecord = {
      path: '/docs/lazy',
      lazy: () => {
        attempts++
        if (attempts === 1) {
          return Promise.reject(new Error('transient chunk failure'))
        }
        return new Promise((resolve) => {
          resolveImport = resolve
        })
      },
    }

    const first = await resolveRouteBranch([route])
    expect(attempts).toBe(1)
    expect(first[0]?.Component).toBeUndefined()

    const pendingA = resolveRouteBranch([route])
    const pendingB = resolveRouteBranch([route])
    expect(attempts).toBe(2)

    await act(async () => {
      resolveImport?.({ Component: () => null })
      await Promise.all([pendingA, pendingB])
    })

    expect(attempts).toBe(2)
    expect((await resolveRouteBranch([route]))[0]?.Component).toBeDefined()
  })

  it('does not treat an empty SSR loader object as loaded data', async () => {
    window.history.replaceState({}, '', '/docs/empty-ssr-data')
    let loaderCalls = 0

    const route: RouteRecord = {
      path: '/docs/empty-ssr-data',
      Component: () => <span>Loaded after SSR</span>,
      loader: () => {
        loaderCalls++
        return { title: 'Loaded' }
      },
    }

    render(
      <RouteRenderer
        routes={[route]}
        pathname="/docs/empty-ssr-data"
        loaderData={{}}
        hasLoaderData={false}
        resolvedBranch={[route]}
        basename="/docs"
      />,
    )

    await waitFor(() => expect(loaderCalls).toBe(1))
    expect(screen.getByText('Loaded after SSR')).toBeInTheDocument()

    cleanup()

    const validEmptyDataRoute: RouteRecord = {
      ...route,
      path: '/docs/valid-empty-ssr-data',
      loader: () => {
        loaderCalls++
        return {}
      },
    }
    window.history.replaceState({}, '', validEmptyDataRoute.path)
    render(
      <RouteRenderer
        routes={[validEmptyDataRoute]}
        pathname={validEmptyDataRoute.path}
        loaderData={{}}
        hasLoaderData
        resolvedBranch={[validEmptyDataRoute]}
        basename="/docs"
      />,
    )
    await waitFor(() => expect(loaderCalls).toBe(1))
  })

  it('completes repeated async navigation without rerunning the same URL forever', async () => {
    window.history.replaceState({}, '', '/docs/a')
    const loaderCalls = new Map<string, number>()
    const lazyCalls = new Map<string, number>()
    const load = (path: string) => {
      loaderCalls.set(path, (loaderCalls.get(path) || 0) + 1)
      return { path }
    }
    const lazy =
      (path: string, nextPath: string, label: string) => async () => {
        lazyCalls.set(path, (lazyCalls.get(path) || 0) + 1)
        return {
          Component: () => (
            <>
              <span>Page {label}</span>
              <NavigationButton
                to={nextPath}
                label={`Go ${label === 'A' ? 'B' : 'A'}`}
              />
            </>
          ),
        }
      }

    const routes: RouteRecord[] = [
      {
        path: '/docs/a',
        lazy: lazy('/docs/a', '/docs/b', 'A'),
        loader: () => load('/docs/a'),
      },
      {
        path: '/docs/b',
        lazy: lazy('/docs/b', '/docs/a', 'B'),
        loader: () => load('/docs/b'),
      },
    ]

    render(
      <RouteRenderer routes={routes} pathname="/docs/a" basename="/docs" />,
    )
    expect(await screen.findByText('Page A')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Go B' }))
    await waitFor(() => expect(screen.getByText('Page B')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Go A' }))
    await waitFor(() => expect(screen.getByText('Page A')).toBeInTheDocument())

    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(loaderCalls.get('/docs/a')).toBe(1)
    expect(loaderCalls.get('/docs/b')).toBe(1)
    expect(lazyCalls.get('/docs/a')).toBe(1)
    expect(lazyCalls.get('/docs/b')).toBe(1)
    expect(window.location.pathname).toBe('/docs/a')
  })

  it('keeps hover prefetch bounded while requests are pending', async () => {
    window.history.replaceState({}, '', '/docs')
    let activeLoaders = 0
    let maxActiveLoaders = 0
    const routes: RouteRecord[] = [
      {
        path: '/docs',
        Component: () => (
          <>
            {Array.from({ length: 20 }, (_, index) => {
              const page = index
              return (
                <PrefetchButton
                  key={`prefetch-${page}`}
                  to={`/docs/page-${page}`}
                />
              )
            })}
          </>
        ),
      },
      ...Array.from({ length: 20 }, (_, index) => {
        const page = index
        return {
          path: `/docs/page-${page}`,
          Component: () => null,
          loader: () => {
            activeLoaders++
            maxActiveLoaders = Math.max(maxActiveLoaders, activeLoaders)
            return new Promise<{ loaded: boolean }>((resolve) => {
              setTimeout(() => {
                activeLoaders--
                resolve({ loaded: true })
              }, 10)
            })
          },
        }
      }),
    ]

    render(<RouteRenderer routes={routes} basename="/docs" />)
    const buttons = await screen.findAllByRole('button', { name: 'Prefetch' })

    await act(async () => {
      for (const button of buttons) {
        button.click()
      }
      await Promise.resolve()
    })

    expect(maxActiveLoaders).toBeLessThanOrEqual(2)
    await waitFor(() => expect(activeLoaders).toBe(0))
  })
})
