import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CRITICAL_CSS_MAX_SIZE,
  resolveCriticalCssMaxSize,
} from '../src/node/critical'

describe('resolveCriticalCssMaxSize', () => {
  it('defaults to 32KB — honest extraction of the docs site measures ~26KB (the old 24KB default was calibrated against a buggy extractor that dropped desktop media queries)', () => {
    expect(DEFAULT_CRITICAL_CSS_MAX_SIZE).toBe(32 * 1024)
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
