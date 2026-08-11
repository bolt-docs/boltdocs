import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocationProvider } from '../../src/client/router'
import { ScrollHandler } from '../../src/client/app/scroll-handler'

describe('ScrollHandler', () => {
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
    window.history.replaceState({}, '', '/')
  })

  it('resets the content scroll position instantly on a normal route commit', async () => {
    window.history.replaceState({}, '', '/docs/source')
    const content = document.createElement('main')
    content.className = 'boltdocs-content'
    content.scrollTop = 640
    const scrollTo = vi.fn()
    content.scrollTo = scrollTo
    document.body.append(content)

    render(
      <LocationProvider>
        <ScrollHandler />
      </LocationProvider>,
    )

    await act(async () => {
      window.history.pushState({}, '', '/docs/target')
      window.dispatchEvent(new PopStateEvent('popstate'))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    act(() => {
      window.dispatchEvent(
        new CustomEvent('boltdocs:route-commit', {
          detail: { pathname: '/docs/target', hash: '' },
        }),
      )
    })

    expect(scrollTo).not.toHaveBeenCalled()
    expect(content.scrollTop).toBe(0)
  })

  it('still scrolls to an explicit hash anchor after a route commit', () => {
    window.history.replaceState({}, '', '/docs/source#target')
    const content = document.createElement('main')
    content.className = 'boltdocs-content'
    content.scrollTop = 100
    content.getBoundingClientRect = () => ({
      top: 0,
      bottom: 800,
      left: 0,
      right: 800,
      width: 800,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const scrollTo = vi.fn()
    content.scrollTo = scrollTo

    const anchor = document.createElement('h2')
    anchor.id = 'target'
    anchor.getBoundingClientRect = () => ({
      top: 500,
      bottom: 540,
      left: 0,
      right: 800,
      width: 800,
      height: 40,
      x: 0,
      y: 500,
      toJSON: () => ({}),
    })
    content.append(anchor)
    document.body.append(content)

    render(
      <LocationProvider>
        <ScrollHandler />
      </LocationProvider>,
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent('boltdocs:route-commit', {
          detail: { pathname: '/docs/source', hash: '#target' },
        }),
      )
    })

    expect(scrollTo).toHaveBeenCalledWith({ top: 520, behavior: 'auto' })
  })
})
