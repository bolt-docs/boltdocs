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
    expect(shouldUseReactPlugin(false)).toBe(true)
    expect(shouldUseReactPlugin(true)).toBe(true)
  })

  it('keeps React Refresh for non-root development bases', () => {
    // A `base: '/docs'` site still needs the refresh runtime, otherwise every
    // layout or external-page edit degrades to a full document reload.
    expect(shouldUseReactPlugin(false)).toBe(true)
    expect(shouldUseReactPlugin(false, 'true')).toBe(true)
  })

  it('allows an explicit opt-out for compatibility testing', () => {
    expect(shouldUseReactPlugin(false, 'false')).toBe(false)
    expect(shouldUseReactPlugin(true, 'false')).toBe(true)
  })

  it('never enables bundled dev in production', () => {
    expect(shouldEnableBundledDev(true, 'true')).toBe(false)
  })
})
