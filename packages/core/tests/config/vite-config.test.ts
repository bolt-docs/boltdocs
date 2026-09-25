import { describe, expect, it } from 'vitest'
import {
  shouldEnableBundledDev,
  shouldUseReactPlugin,
} from '../../src/node/index'

describe('Vite dev bundling', () => {
  it('keeps bundled dev opt-in outside production', () => {
    expect(shouldEnableBundledDev(false, undefined)).toBe(false)
    expect(shouldEnableBundledDev(false, 'true')).toBe(true)
  })

  it('allows an explicit opt-out for compatibility testing', () => {
    expect(shouldEnableBundledDev(false, 'false')).toBe(false)
  })

  it('uses the React plugin for root and production builds', () => {
    expect(shouldUseReactPlugin(false, '/', undefined)).toBe(true)
    expect(shouldUseReactPlugin(true, '/docs', undefined)).toBe(true)
  })

  it('avoids React Refresh for non-root development bases', () => {
    expect(shouldUseReactPlugin(false, '/docs', undefined)).toBe(false)
    expect(shouldUseReactPlugin(false, '/docs', 'true')).toBe(true)
  })

  it('never enables bundled dev in production', () => {
    expect(shouldEnableBundledDev(true, 'true')).toBe(false)
  })
})
