// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

// vi.mock factories are hoisted above top-level consts, so the mock must be
// created with vi.hoisted to be referenceable from the factory.
const { hydrate, render } = vi.hoisted(() => ({
  hydrate: vi.fn(),
  render: vi.fn(),
}))

vi.mock('../src/polyfill/react-helper', () => ({
  hydrate,
  render,
}))

import { ViteReactSSG } from '../src/client/single-page'

describe('ViteReactSSG initial client route', () => {
  afterEach(() => {
    hydrate.mockReset()
    render.mockReset()
    window.history.replaceState({}, '', '/')
    document.body.innerHTML = ''
  })

  it('passes the resolved lazy branch to the first RouteRenderer render', async () => {
    window.history.replaceState({}, '', '/docs')
    document.body.innerHTML =
      '<div id="root" data-server-rendered="true"></div>'

    const unresolvedRoute = {
      path: '/docs',
      lazy: async () => ({ Component: () => null }),
    }
    const resolvedRoute = {
      ...unresolvedRoute,
      Component: () => null,
    }
    const RouteRenderer = () => null
    const matchRouteBranch = vi.fn(() => [unresolvedRoute])
    const resolveRouteBranch = vi.fn(async () => [resolvedRoute])
    const app = {
      routes: [unresolvedRoute],
      RouteRenderer,
      matchRouteBranch,
      resolveRouteBranch,
    }

    ViteReactSSG(app)

    await vi.waitFor(() => expect(hydrate).toHaveBeenCalledTimes(1))

    const renderedTree = hydrate.mock.calls[0]?.[0] as {
      props?: { children?: { props?: { resolvedBranch?: unknown[] } } }
    }
    const routeRenderer = renderedTree.props?.children
    expect(routeRenderer?.props?.resolvedBranch).toEqual([resolvedRoute])
    expect(resolveRouteBranch).toHaveBeenCalledWith([unresolvedRoute])
  })
})
