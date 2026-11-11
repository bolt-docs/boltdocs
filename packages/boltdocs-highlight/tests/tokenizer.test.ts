import { describe, it, expect } from 'vitest'
import { canonicalLanguage, ensurePrismLanguage } from '../src/languages.js'
import Prism from 'prismjs'

describe('language resolution (Prism)', () => {
  it('maps common aliases to canonical Prism ids', () => {
    expect(canonicalLanguage('js')).toBe('javascript')
    expect(canonicalLanguage('ts')).toBe('typescript')
    expect(canonicalLanguage('tsx')).toBe('tsx')
    expect(canonicalLanguage('sh')).toBe('bash')
    expect(canonicalLanguage('yml')).toBe('yaml')
    expect(canonicalLanguage('html')).toBe('markup')
    expect(canonicalLanguage('py')).toBe('python')
  })

  it('treats plain/text aliases as plain', () => {
    expect(canonicalLanguage('text')).toBe('plain')
    expect(canonicalLanguage('plaintext')).toBe('plain')
    expect(canonicalLanguage('')).toBe('plain')
  })

  it('loads grammars on demand', () => {
    expect(ensurePrismLanguage(Prism as any, 'typescript')).toBe('typescript')
    expect(ensurePrismLanguage(Prism as any, 'rust')).toBe('rust')
    expect(ensurePrismLanguage(Prism as any, 'not-a-language')).toBe(null)
  })
})
