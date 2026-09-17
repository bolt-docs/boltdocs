import { describe, expect, it } from 'vitest'
import { normalizeCodeHighlightConfig } from '../src/code-highlight'

describe('normalizeCodeHighlightConfig', () => {
  it('maps a string shorthand to an engine id config', () => {
    expect(normalizeCodeHighlightConfig('shiki')).toEqual({
      engine: 'shiki',
    })
  })

  it('passes through object configs untouched', () => {
    const config = {
      engine: 'my-engine',
      theme: { light: 'github-light', dark: 'github-dark' },
      options: { regexEngine: 'javascript' },
    }
    expect(normalizeCodeHighlightConfig(config)).toBe(config)
  })

  it('passes through undefined so ?? codeTheme chains keep working', () => {
    expect(normalizeCodeHighlightConfig(undefined)).toBeUndefined()
  })

  it('keeps engine adapter objects and factories intact', () => {
    const adapter = { name: 'x', initialize: async () => ({}) }
    expect(normalizeCodeHighlightConfig({ engine: adapter })).toEqual({
      engine: adapter,
    })
    const factory = () => adapter
    expect(normalizeCodeHighlightConfig({ engine: factory })).toEqual({
      engine: factory,
    })
  })
})
