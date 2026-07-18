import { describe, it, expect, vi } from 'vitest'
import {
  wrapRemarkPlugin,
  wrapRemarkCodePlugin,
} from '../node/satteri-plugins/remark-adapter'

vi.mock('satteri', () => ({
  defineMdastPlugin: (def: unknown) => def,
}))

describe('wrapRemarkPlugin', () => {
  it('returns null for null input', () => {
    expect(wrapRemarkPlugin(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(wrapRemarkPlugin(undefined)).toBeNull()
  })

  it('passes through Sätteri MDAST plugin definitions', () => {
    const plugin = {
      name: 'test-plugin',
      code: () => {},
    }
    const result = wrapRemarkPlugin(plugin)
    expect(result).toBe(plugin)
  })

  it('wraps a factory function', () => {
    const factory = () => (tree: unknown) => {}
    const result = wrapRemarkPlugin(factory)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('name', 'satteri-remark-adapter')
    expect(result).toHaveProperty('code')
  })

  it('wraps the original function as transformer when factory throws', () => {
    const factory = () => {
      throw new Error('factory error')
    }
    const result = wrapRemarkPlugin(factory)
    // New behavior: falls back to using the original function as transformer
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('name', 'satteri-remark-adapter')
  })

  it('wraps the original function as transformer when factory returns non-function', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const factory = () => 'not a function' as unknown as undefined
    const result = wrapRemarkPlugin(factory)
    // New behavior: falls back to using the original function as transformer
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('name', 'satteri-remark-adapter')
    // Should not warn since we successfully wrapped it
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('wrapRemarkCodePlugin', () => {
  const config = { theme: 'dark' }
  const componentName = 'Mermaid'
  const language = 'mermaid'

  it('returns null for null input', () => {
    expect(
      wrapRemarkCodePlugin(null, config, componentName, language),
    ).toBeNull()
  })

  it('wraps a factory function', () => {
    const factory = () => (tree: unknown) => {}
    const result = wrapRemarkCodePlugin(
      factory,
      config,
      componentName,
      language,
    )
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('name', 'satteri-mermaid-adapter')
    expect(result).toHaveProperty('code')
  })

  it('passes config to factory', () => {
    const factory = vi.fn().mockReturnValue((tree: unknown) => {})
    wrapRemarkCodePlugin(factory, config, componentName, language)
    expect(factory).toHaveBeenCalledWith(config)
  })

  it('returns null when factory throws', () => {
    const factory = () => {
      throw new Error('fail')
    }
    expect(
      wrapRemarkCodePlugin(factory, config, componentName, language),
    ).toBeNull()
  })

  it('returns null when factory returns non-function', () => {
    const factory = () => undefined
    expect(
      wrapRemarkCodePlugin(factory, config, componentName, language),
    ).toBeNull()
  })
})
