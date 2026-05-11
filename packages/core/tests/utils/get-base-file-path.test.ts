import { describe, it, expect } from 'vitest'
import { getBaseFilePath } from '../../src/client/utils/get-base-file-path'

describe('getBaseFilePath', () => {
  it('should return original path when no version or locale', () => {
    expect(getBaseFilePath('/docs/index.md', undefined, undefined)).toBe('/docs/index.md')
  })

  it('should remove version prefix', () => {
    expect(getBaseFilePath('v1/index.md', 'v1', undefined)).toBe('index.md')
    expect(getBaseFilePath('v1/docs/guide.md', 'v1', undefined)).toBe('docs/guide.md')
  })

  it('should return index.md when path equals version', () => {
    expect(getBaseFilePath('v1', 'v1', undefined)).toBe('index.md')
  })

  it('should remove locale prefix', () => {
    expect(getBaseFilePath('en/index.md', undefined, 'en')).toBe('index.md')
    expect(getBaseFilePath('es/docs/guide.md', undefined, 'es')).toBe('docs/guide.md')
  })

  it('should return index.md when path equals locale', () => {
    expect(getBaseFilePath('en', undefined, 'en')).toBe('index.md')
  })

  it('should remove both version and locale prefixes', () => {
    expect(getBaseFilePath('v1/en/docs.md', 'v1', 'en')).toBe('docs.md')
    expect(getBaseFilePath('v2/es/index.md', 'v2', 'es')).toBe('index.md')
  })

  it('should handle locale before version', () => {
    expect(getBaseFilePath('v1/en', 'v1', 'en')).toBe('index.md')
  })

  it('should not remove version if path does not start with version', () => {
    expect(getBaseFilePath('/docs/v1.md', 'v1', undefined)).toBe('/docs/v1.md')
  })

  it('should not remove locale if path does not start with locale', () => {
    expect(getBaseFilePath('/docs/en.md', undefined, 'en')).toBe('/docs/en.md')
  })

  it('should handle nested paths with version and locale', () => {
    expect(getBaseFilePath('v1/en/guides/getting-started.md', 'v1', 'en')).toBe('guides/getting-started.md')
  })

  it('should handle version with slash but not matching prefix', () => {
    expect(getBaseFilePath('/my-v1/docs.md', 'v1', undefined)).toBe('/my-v1/docs.md')
  })

  it('should handle locale with slash but not matching prefix', () => {
    expect(getBaseFilePath('/my-en/docs.md', undefined, 'en')).toBe('/my-en/docs.md')
  })
})