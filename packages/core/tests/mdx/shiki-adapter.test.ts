import { describe, it, expect, vi, afterAll } from 'vitest'
import {
  parseMetaString,
  ShikiAdapter,
  getShikiAdapter,
} from '../../src/node/mdx/shiki-adapter'
import { DEFAULT_THEMES } from '../../src/node/mdx/constants'

describe('parseMetaString', () => {
  it('returns an empty object for empty input', () => {
    expect(parseMetaString('')).toEqual({})
  })

  it('detects lineNumbers aliases', () => {
    const a = parseMetaString('lineNumbers')
    const b = parseMetaString('showLineNumbers')
    expect(a.lineNumbers).toBe(true)
    expect(b.lineNumbers).toBe(true)
  })

  it('detects wordWrap aliases', () => {
    const a = parseMetaString('wordWrap')
    const b = parseMetaString('word-wrap')
    expect(a.wordWrap).toBe(true)
    expect(b.wordWrap).toBe(true)
  })

  it('respects explicit false values and normalized aliases', () => {
    const a = parseMetaString('showLineNumbers=false wordWrap=false')
    const b = parseMetaString(
      'show-line-numbers title="demo.ts" word_wrap=true',
    )
    expect(a.lineNumbers).toBe(false)
    expect(a.wordWrap).toBe(false)
    expect(b.lineNumbers).toBe(true)
    expect(b.wordWrap).toBe(true)
  })

  it('extracts a quoted title', () => {
    const meta = parseMetaString('title="Getting Started" lineNumbers')
    expect(meta.title).toBe('Getting Started')
    expect(meta.lineNumbers).toBe(true)
  })
})

describe('ShikiAdapter', () => {
  afterAll(() => {
    vi.doUnmock('../../src/node/mdx/highlighter')
  })

  it('returns the configured code theme or default light/dark', () => {
    const theme = new ShikiAdapter().getTheme()
    expect(theme).toHaveProperty('light', DEFAULT_THEMES.LIGHT)
    expect(theme).toHaveProperty('dark', DEFAULT_THEMES.DARK)
  })

  it('getOptions assembles transformers and theme', () => {
    const adapter = new ShikiAdapter()
    const opts = adapter.getOptions('ts', 'lineNumbers')
    expect((opts as any).lang).toBe('ts')
    expect((opts as any).themes).toBeDefined()
    expect(Array.isArray((opts as any).transformers)).toBe(true)
    expect(Object.keys((opts as any).meta)).toEqual(['__raw'])
    expect((opts as any).meta.lineNumbers).toBe(true)
  })

  it('getShikiAdapter caches by code theme config', () => {
    const adapterConfig = {
      theme: { codeTheme: { light: 'github-light', dark: 'github-dark' } },
    }
    const first = getShikiAdapter(adapterConfig as any)
    // Deep-equal codeTheme config reuses the same instance.
    const again = getShikiAdapter(adapterConfig as any)
    expect(first).toBe(again)
  })

  it('getShikiAdapter rebuilds when the code theme changes', () => {
    const a = getShikiAdapter({
      theme: { codeTheme: { light: 'github-light', dark: 'github-dark' } },
    } as any)
    const b = getShikiAdapter({
      theme: { codeTheme: { light: 'min-light', dark: 'min-dark' } },
    } as any)
    expect(a).not.toBe(b)
  })
})
