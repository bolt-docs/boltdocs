import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CRITICAL_CSS_MAX_SIZE,
  resolveCriticalCssMaxSize,
} from '../src/node/critical'

describe('resolveCriticalCssMaxSize', () => {
  it('defaults to 24KB — above the 16–18KB real-world docs critical CSS', () => {
    expect(DEFAULT_CRITICAL_CSS_MAX_SIZE).toBe(24 * 1024)
    expect(resolveCriticalCssMaxSize(undefined)).toBe(
      DEFAULT_CRITICAL_CSS_MAX_SIZE,
    )
  })

  it('uses the configured budget when valid', () => {
    expect(resolveCriticalCssMaxSize(0)).toBe(0)
    expect(resolveCriticalCssMaxSize(8192)).toBe(8192)
    expect(resolveCriticalCssMaxSize(1024 * 1024)).toBe(1024 * 1024)
  })

  it('falls back to the default on invalid values', () => {
    expect(resolveCriticalCssMaxSize(-1)).toBe(DEFAULT_CRITICAL_CSS_MAX_SIZE)
    expect(resolveCriticalCssMaxSize(NaN)).toBe(DEFAULT_CRITICAL_CSS_MAX_SIZE)
    expect(resolveCriticalCssMaxSize('big' as unknown as number)).toBe(
      DEFAULT_CRITICAL_CSS_MAX_SIZE,
    )
  })
})
