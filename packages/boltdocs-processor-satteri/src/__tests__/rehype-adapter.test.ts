import { describe, it, expect, vi } from 'vitest'
import { wrapHastPlugin } from '../node/satteri-plugins/rehype-adapter'

vi.mock('satteri', () => ({
  defineHastPlugin: (def: unknown) => def,
}))

describe('wrapHastPlugin', () => {
  it('returns null for null input', () => {
    expect(wrapHastPlugin(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(wrapHastPlugin(undefined)).toBeNull()
  })

  it('wraps a factory function', () => {
    const factory = () => (tree: { type: string; children: unknown[] }) => {}
    const result = wrapHastPlugin(factory)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('name', 'satteri-rehype-adapter')
    expect(
      (result as unknown as Record<string, unknown>).element,
    ).toHaveProperty('filter', [])
  })

  it('returns null when factory throws', () => {
    const factory = () => {
      throw new Error('factory error')
    }
    expect(wrapHastPlugin(factory)).toBeNull()
  })

  it('returns null when factory returns non-function', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const factory = () => 'invalid' as unknown as undefined
    expect(wrapHastPlugin(factory)).toBeNull()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('handles non-function, non-object input gracefully', () => {
    expect(wrapHastPlugin('invalid' as unknown as undefined)).toBeNull()
  })
})
