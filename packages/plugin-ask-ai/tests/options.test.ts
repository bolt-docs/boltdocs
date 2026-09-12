import { describe, it, expect } from 'vitest'
import {
  AskAiPluginOptionsSchema,
  PROVIDER_PRESETS,
  buildClientMetadata,
} from '../src/node/options'

describe('AskAiPluginOptionsSchema', () => {
  it('applies the default provider and model', () => {
    const parsed = AskAiPluginOptionsSchema.parse({})
    expect(parsed.autoInject).toBe(true)
    expect(parsed.provider).toBe('openai')
    expect(parsed.model).toBe(PROVIDER_PRESETS.openai.defaultModel)
  })

  it('allows manual composition without automatic injection', () => {
    const parsed = AskAiPluginOptionsSchema.parse({ autoInject: false })
    expect(parsed.autoInject).toBe(false)
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

  it('defaults generation params and UI copy', () => {
    const parsed = AskAiPluginOptionsSchema.parse({})
    expect(parsed.temperature).toBe(0.3)
    expect(parsed.topP).toBe(1)
    expect(parsed.title).toBe('Ask Assistant')
    expect(parsed.placeholder).toBe('Ask about this page…')
    expect(parsed.emptyTitle).toBe('How can I help you today?')
    expect(parsed.buttonTooltip).toBe('Ask AI assistant')
    expect(parsed.composerHint).toBe(
      'Enter to send · Shift+Enter for a new line',
    )
    expect(parsed.emptyDescription).toContain('documentation page')
  })

  it('accepts custom UI copy and persona', () => {
    const parsed = AskAiPluginOptionsSchema.parse({
      title: 'Docs Copilot',
      placeholder: 'Ask the docs…',
      persona: 'You are "Nyx", a pirate-flavoured docs pirate.',
    })
    expect(parsed.title).toBe('Docs Copilot')
    expect(parsed.placeholder).toBe('Ask the docs…')
    expect(parsed.persona).toContain('Nyx')
  })

  it('rejects out-of-range generation params', () => {
    expect(AskAiPluginOptionsSchema.safeParse({ temperature: 3 }).success).toBe(
      false,
    )
    expect(AskAiPluginOptionsSchema.safeParse({ topP: 1.5 }).success).toBe(
      false,
    )
    expect(AskAiPluginOptionsSchema.safeParse({ title: '' }).success).toBe(
      false,
    )
    expect(AskAiPluginOptionsSchema.safeParse({ persona: '' }).success).toBe(
      false,
    )
  })

  describe('buildClientMetadata', () => {
    it('exposes the client-facing UI copy', () => {
      const parsed = AskAiPluginOptionsSchema.parse({
        title: 'Docs Copilot',
        placeholder: 'Ask the docs…',
      })
      const meta = buildClientMetadata(parsed)
      expect(meta.title).toBe('Docs Copilot')
      expect(meta.placeholder).toBe('Ask the docs…')
      expect(meta.endpoint).toBe('/api/ask-ai')
      expect(meta.provider).toBe('openai')
      expect(meta.devMode).toBe(false)
    })
  })
})
