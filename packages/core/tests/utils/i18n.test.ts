import { describe, it, expect } from 'vitest'
import { getTranslated } from '../../src/client/utils/i18n'

describe('getTranslated - i18n utility', () => {
  it('should return empty string for undefined', () => {
    expect(getTranslated(undefined)).toBe('')
  })

  it('should return empty string for empty string', () => {
    expect(getTranslated('')).toBe('')
  })

  it('should return string as-is when passed a plain string', () => {
    expect(getTranslated('Hello World')).toBe('Hello World')
  })

  it('should return matching locale translation', () => {
    const translations = { en: 'Hello', es: 'Hola', fr: 'Bonjour' }
    expect(getTranslated(translations, 'es')).toBe('Hola')
  })

  it('should fallback to first translation when locale not found', () => {
    const translations = { en: 'Hello', es: 'Hola' }
    expect(getTranslated(translations, 'fr')).toBe('Hello')
  })

  it('should return empty string when no translations available', () => {
    const translations = {}
    expect(getTranslated(translations, 'en')).toBe('')
  })

  it('should handle locale key that is undefined', () => {
    const translations = { en: 'Hello' }
    expect(getTranslated(translations, undefined)).toBe('Hello')
  })

  it('should handle translations with single locale', () => {
    const translations = { en: 'Only English' }
    expect(getTranslated(translations, 'es')).toBe('Only English')
  })
})
