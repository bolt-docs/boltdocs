import { describe, it, expect } from 'vitest'
import { AskAiPluginOptionsSchema, PROVIDER_PRESETS } from '../src/node/options'

describe('AskAiPluginOptionsSchema', () => {
  it('applies the default provider and model', () => {
    const parsed = AskAiPluginOptionsSchema.parse({})
    expect(parsed.provider).toBe('openai')
    expect(parsed.model).toBe(PROVIDER_PRESETS.openai.defaultModel)
  })

  it('accepts an explicit provider and model', () => {
    const parsed = AskAiPluginOptionsSchema.parse({
      provider: 'anthropic',
      model: 'claude-x',
    })
    expect(parsed.model).toBe('claude-x')
  })

  it('rejects unknown providers', () => {
    const result = AskAiPluginOptionsSchema.safeParse({ provider: 'nope' })
    expect(result.success).toBe(false)
  })

  it('rejects a too-long model', () => {
    const result = AskAiPluginOptionsSchema.safeParse({
      model: 'x'.repeat(121),
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative maxInputChars', () => {
    const result = AskAiPluginOptionsSchema.safeParse({ maxInputChars: -1 })
    expect(result.success).toBe(false)
  })

  it('accepts a valid secretKey', () => {
    const result = AskAiPluginOptionsSchema.safeParse({
      secretKey: 'a'.repeat(8),
    })
    expect(result.success).toBe(true)
  })

  it('rejects a short secretKey', () => {
    const result = AskAiPluginOptionsSchema.safeParse({ secretKey: 'x' })
    expect(result.success).toBe(false)
  })
})
