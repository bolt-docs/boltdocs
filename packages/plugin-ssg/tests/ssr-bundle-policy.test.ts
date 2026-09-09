import { describe, expect, it } from 'vitest'
import {
  SSR_BUNDLED_PACKAGE_PATTERNS,
  SSR_EXTERNAL_PACKAGE_NAMES,
} from '../src/node/ssr-bundle-policy'

describe('SSR bundle policy', () => {
  it('bundles Boltdocs internals', () => {
    expect(
      SSR_BUNDLED_PACKAGE_PATTERNS.some((pattern) =>
        pattern.test('@bdocs/ssg'),
      ),
    ).toBe(true)
    expect(
      SSR_BUNDLED_PACKAGE_PATTERNS.some((pattern) =>
        pattern.test('boltdocs/client'),
      ),
    ).toBe(true)
  })

  it('externalizes only the consumer-owned React runtime', () => {
    expect(SSR_EXTERNAL_PACKAGE_NAMES).toEqual(['react', 'react-dom'])
    expect(
      SSR_BUNDLED_PACKAGE_PATTERNS.some((pattern) => pattern.test('react')),
    ).toBe(false)
    expect(
      SSR_BUNDLED_PACKAGE_PATTERNS.some((pattern) =>
        pattern.test('react-dom/server'),
      ),
    ).toBe(false)
  })

  it('bundles Helmet because it is an SSG runtime dependency', () => {
    expect(
      SSR_BUNDLED_PACKAGE_PATTERNS.some((pattern) =>
        pattern.test('react-helmet-async'),
      ),
    ).toBe(true)
  })
})
