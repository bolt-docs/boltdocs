import { describe, expect, it } from 'vitest'
import {
  normalizeCodeHighlightConfig,
  normalizeCodeTheme,
} from '../src/code-highlight'

describe('normalizeCodeHighlightConfig', () => {
  it('maps a string shorthand to an engine id config', () => {
    expect(normalizeCodeHighlightConfig('shiki')).toEqual({
      engine: 'shiki',
    })
  })

  it('passes the configuration through, with the theme narrowed', () => {
    const config = {
      engine: 'my-engine',
      theme: { light: 'github-light', dark: 'github-dark' },
      options: { regexEngine: 'javascript' },
    }
    expect(normalizeCodeHighlightConfig(config)).toEqual(config)
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

  it('drops a theme the pipeline cannot use', () => {
    // The public theme type is open: an engine with its own colour model
    // cannot be enumerated. The pipeline is not that engine, and a theme it
    // cannot read used to reach it as a pair of `undefined`s.
    expect(
      normalizeCodeHighlightConfig({
        engine: 'my-engine',
        theme: { tokens: { '--shiki-token': '#fff' } },
      }),
    ).toEqual({ engine: 'my-engine', theme: undefined })
  })
})

describe('normalizeCodeTheme', () => {
  it('keeps a theme name', () => {
    expect(normalizeCodeTheme('github-dark')).toBe('github-dark')
  })

  it('keeps a light and dark pair', () => {
    expect(normalizeCodeTheme({ light: 'a', dark: 'b' })).toEqual({
      light: 'a',
      dark: 'b',
    })
  })

  it('drops a theme it cannot read', () => {
    expect(normalizeCodeTheme({ tokens: {} })).toBeUndefined()
    expect(normalizeCodeTheme({ light: 'a' })).toBeUndefined()
    expect(normalizeCodeTheme(undefined)).toBeUndefined()
  })
})
