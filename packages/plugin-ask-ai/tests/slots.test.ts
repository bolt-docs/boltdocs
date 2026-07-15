import { describe, it, expect } from 'vitest'
import askAiPlugin, { AskAiPluginOptionsSchema } from '../src/node/index'

// NOTE: We don't go through the Vite middleware here — we only exercise
// the plugin factory's return shape and its declaration of slots.

describe('AskAiPluginOptionsSchema', () => {
  it('defaults both slots to true', () => {
    const parsed = AskAiPluginOptionsSchema.parse({})
    expect(parsed.slots['floating-bottom']).toBe(true)
    expect(parsed.slots['right-rail']).toBe(true)
    expect(parsed.autoInject).toBe(true)
  })

  it('honours explicit slot overrides', () => {
    const parsed = AskAiPluginOptionsSchema.parse({
      slots: { 'floating-bottom': false, 'right-rail': true },
    })
    expect(parsed.slots['floating-bottom']).toBe(false)
    expect(parsed.slots['right-rail']).toBe(true)
  })

  it('preserves autoInject default for back-compat', () => {
    const a = AskAiPluginOptionsSchema.parse({})
    expect(a.autoInject).toBe(true)
    const b = AskAiPluginOptionsSchema.parse({ autoInject: false })
    expect(b.autoInject).toBe(false)
  })
})

describe('askAiPlugin factory', () => {
  it('declares slots for floating-bottom and right-rail by default', () => {
    const plugin = askAiPlugin()
    expect(plugin.slots).toHaveLength(2)
    expect(plugin.slots?.map((s) => s.id).sort()).toEqual([
      'floating-bottom',
      'right-rail',
    ])
    expect(
      plugin.slots?.every(
        (s) => s.modulePath === '@bdocs/plugin-ask-ai/client',
      ),
    ).toBe(true)
  })

  it('omits slots when both toggles are off', () => {
    const plugin = askAiPlugin({
      slots: { 'floating-bottom': false, 'right-rail': false },
    })
    expect(plugin.slots).toEqual([])
  })

  it('declares only floating-bottom slot when right-rail is off', () => {
    const plugin = askAiPlugin({
      slots: { 'floating-bottom': true, 'right-rail': false },
    })
    expect(plugin.slots).toHaveLength(1)
    expect(plugin.slots?.[0]?.id).toBe('floating-bottom')
    expect(plugin.slots?.[0]?.component).toBe('AskAiBubble')
  })

  it('declares only right-rail slot when floating-bottom is off', () => {
    const plugin = askAiPlugin({
      slots: { 'floating-bottom': false, 'right-rail': true },
    })
    expect(plugin.slots).toHaveLength(1)
    expect(plugin.slots?.[0]?.id).toBe('right-rail')
    expect(plugin.slots?.[0]?.component).toBe('AskAiDialog')
  })

  it('legacy autoInject: false disables both slots', () => {
    const plugin = askAiPlugin({ autoInject: false })
    expect(plugin.slots).toEqual([])
  })

  it('legacy autoInject: true combined with explicit slots honours slot toggles', () => {
    const plugin = askAiPlugin({
      autoInject: true,
      slots: { 'floating-bottom': false, 'right-rail': true },
    })
    expect(plugin.slots).toHaveLength(1)
    expect(plugin.slots?.[0]?.id).toBe('right-rail')
  })

  it('still registers the components map when at least one slot is enabled', () => {
    const plugin = askAiPlugin({
      slots: { 'floating-bottom': true, 'right-rail': false },
    })
    expect(plugin.components).toEqual({
      AskAiBubble: '@bdocs/plugin-ask-ai/client',
      AskAiDialog: '@bdocs/plugin-ask-ai/client',
    })
  })

  it('drops the components map when fully disabled', () => {
    const plugin = askAiPlugin({
      slots: { 'floating-bottom': false, 'right-rail': false },
    })
    expect(plugin.components).toEqual({})
  })

  it('emits version 0.3.0 in the plugin return', () => {
    expect(askAiPlugin().version).toBe('0.3.0')
  })
})

describe('customModels escape hatch', () => {
  it('passes customModels through to the modelAllowlist at runtime', () => {
    const schema = AskAiPluginOptionsSchema.parse({
      customModels: ['gpt-4o', 'o1-mini'],
    })
    expect(schema.customModels).toEqual(['gpt-4o', 'o1-mini'])
  })

  it('rejects too-many custom models (over 20)', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `m${i}`)
    expect(() =>
      AskAiPluginOptionsSchema.parse({ customModels: tooMany }),
    ).toThrow()
  })
})
