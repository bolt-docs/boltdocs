// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  observeForPrefetch,
  resetViewportPrefetchObserver,
} from '../src/client/router/prefetch-viewport'

type ObserverCallback = (
  entries: Partial<IntersectionObserverEntry>[],
  observer: IntersectionObserver,
) => void

let instances: Array<{
  callback: ObserverCallback
  observed: Set<Element>
  unobserved: Set<Element>
  disconnected: boolean
  options: IntersectionObserverInit | undefined
}> = []

class FakeIntersectionObserver {
  private record: (typeof instances)[number]

  constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
    this.record = {
      callback,
      observed: new Set(),
      unobserved: new Set(),
      disconnected: false,
      options,
    }
    instances.push(this.record)
  }

  observe(el: Element) {
    this.record.observed.add(el)
  }

  unobserve(el: Element) {
    this.record.unobserved.add(el)
  }

  disconnect() {
    this.record.disconnected = true
  }

  takeRecords() {
    return []
  }

  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = []
}

const enter = (el: Element) => {
  for (const record of instances) {
    if (record.observed.has(el)) {
      record.callback([{ target: el, isIntersecting: true }], null as never)
    }
  }
}

beforeEach(() => {
  instances = []
  resetViewportPrefetchObserver()
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})

afterEach(() => {
  resetViewportPrefetchObserver()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('observeForPrefetch', () => {
  it('invokes the callback when the element becomes visible', () => {
    const el = document.createElement('a')
    document.body.append(el)
    const run = vi.fn()

    observeForPrefetch(el, run)
    expect(run).not.toHaveBeenCalled()

    enter(el)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('reuses a single shared observer for every link', () => {
    const a = document.createElement('a')
    const b = document.createElement('a')
    document.body.append(a, b)

    observeForPrefetch(a, vi.fn())
    observeForPrefetch(b, vi.fn())

    // One observer for the page, not one per anchor.
    expect(instances).toHaveLength(1)
  })

  it('stops observing after the first intersection', () => {
    const el = document.createElement('a')
    document.body.append(el)
    const run = vi.fn()

    observeForPrefetch(el, run)
    enter(el)
    enter(el)

    expect(run).toHaveBeenCalledTimes(1)
    expect(instances[0].unobserved.has(el)).toBe(true)
  })

  it('warms slightly before the link is on screen', () => {
    const el = document.createElement('a')
    observeForPrefetch(el, vi.fn())

    expect(instances[0].options?.rootMargin).toBe('200px 0px')
  })

  it('ignores non-intersecting entries', () => {
    const el = document.createElement('a')
    document.body.append(el)
    const run = vi.fn()

    observeForPrefetch(el, run)
    for (const record of instances) {
      record.callback([{ target: el, isIntersecting: false }], null as never)
    }

    expect(run).not.toHaveBeenCalled()
  })

  it('stops calling back after cleanup', () => {
    const el = document.createElement('a')
    document.body.append(el)
    const run = vi.fn()

    const cleanup = observeForPrefetch(el, run)
    cleanup()
    enter(el)

    expect(run).not.toHaveBeenCalled()
  })

  it('is a safe no-op for a null element', () => {
    const run = vi.fn()
    expect(() => observeForPrefetch(null, run)()).not.toThrow()
    expect(instances).toHaveLength(0)
  })

  it('degrades gracefully when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const el = document.createElement('a')
    const run = vi.fn()

    expect(() => observeForPrefetch(el, run)()).not.toThrow()
    expect(run).not.toHaveBeenCalled()
  })
})
