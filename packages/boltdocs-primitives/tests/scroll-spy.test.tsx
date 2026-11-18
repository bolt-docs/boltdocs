import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import {
  getItemId,
  ScrollSpyProvider,
  useActiveAnchors,
} from '../src/scroll-spy'

type Callback = (entries: IntersectionObserverEntry[]) => void

class FakeIntersectionObserver {
  static last: FakeIntersectionObserver | null = null
  callback: Callback
  observed = new Set<Element>()

  constructor(callback: Callback) {
    this.callback = callback
    FakeIntersectionObserver.last = this
  }
  observe(el: Element) {
    this.observed.add(el)
  }
  unobserve(el: Element) {
    this.observed.delete(el)
  }
  disconnect() {
    this.observed.clear()
  }
  fire() {
    this.callback([])
  }
}

function Active() {
  const active = useActiveAnchors()
  return <span data-testid="active">{active.join(',')}</span>
}

describe('scroll-spy', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    for (const id of ['one', 'two']) {
      const el = document.createElement('div')
      el.id = id
      document.body.appendChild(el)
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('reads heading ids from hash links only', () => {
    expect(getItemId('#one')).toBe('one')
    expect(getItemId('/docs#two')).toBeNull()
  })

  it('exposes the headings that are in the viewport', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        return {
          top: this.id === 'two' ? 200 : -200,
          bottom: this.id === 'two' ? 300 : -100,
        } as DOMRect
      },
    )

    render(
      <ScrollSpyProvider items={[{ url: '#one' }, { url: '#two' }]}>
        <Active />
      </ScrollSpyProvider>,
    )

    act(() => FakeIntersectionObserver.last?.fire())
    expect(screen.getByTestId('active')).toHaveTextContent('two')
  })

  it('keeps a single active item in single mode', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 200,
    } as DOMRect)

    render(
      <ScrollSpyProvider single items={[{ url: '#one' }, { url: '#two' }]}>
        <Active />
      </ScrollSpyProvider>,
    )

    act(() => FakeIntersectionObserver.last?.fire())
    const ids = screen.getByTestId('active').textContent?.split(',') ?? []
    expect(ids).toHaveLength(1)
  })

  it('degrades gracefully without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(
      <ScrollSpyProvider items={[{ url: '#one' }]}>
        <Active />
      </ScrollSpyProvider>,
    )
    expect(screen.getByTestId('active')).toBeEmptyDOMElement()
  })
})
