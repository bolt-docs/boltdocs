import { afterEach, describe, expect, it, vi } from 'vitest'
import { prefersReducedMotion, resolveTransitionTypes } from '@bdocs/runtime'

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('prefersReducedMotion', () => {
  it('returns true when the visitor requests reduced motion', () => {
    mockMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)
  })

  it('returns false when the visitor does not request reduced motion', () => {
    mockMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('returns false when matchMedia is unavailable', () => {
    // @ts-expect-error deliberately removing the API
    delete window.matchMedia
    expect(prefersReducedMotion()).toBe(false)
  })

  it('returns false when matchMedia throws', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: () => {
        throw new Error('unsupported')
      },
    })
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('resolveTransitionTypes', () => {
  it('returns undefined when there are no types', () => {
    expect(resolveTransitionTypes(undefined, 'none')).toBeUndefined()
  })

  it('keeps configured types when the direction is none', () => {
    expect(resolveTransitionTypes(['page'], 'none')).toEqual(['page'])
  })

  it('appends the navigation direction', () => {
    expect(resolveTransitionTypes(['page'], 'forward')).toEqual([
      'page',
      'forward',
    ])
    expect(resolveTransitionTypes(['page'], 'back')).toEqual(['page', 'back'])
  })

  it('uses the direction alone when nothing is configured', () => {
    expect(resolveTransitionTypes(undefined, 'back')).toEqual(['back'])
  })

  it('does not duplicate a type already present', () => {
    expect(resolveTransitionTypes(['forward'], 'forward')).toEqual(['forward'])
  })
})
