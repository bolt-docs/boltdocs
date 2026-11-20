import { describe, it, expect } from 'vitest'
import {
  PluginError,
  PluginValidationError,
  PluginCompatibilityError,
  PluginHookError,
} from '../../src/node/plugins/plugin-errors'

describe('PluginError', () => {
  it('should format message with plugin name prefix', () => {
    const err = new PluginError('test-plugin', 'Something went wrong')
    expect(err.message).toBe('[plugin:test-plugin] Something went wrong')
    expect(err.pluginName).toBe('test-plugin')
    expect(err.name).toBe('PluginError')
  })

  it('should support ErrorOptions (cause)', () => {
    const cause = new Error('root cause')
    const err = new PluginError('test-plugin', 'Wrapped', { cause })
    expect(err.cause).toBe(cause)
  })
})

describe('PluginValidationError', () => {
  it('should extend PluginError with validation prefix', () => {
    const err = new PluginValidationError('test-plugin', 'Name is required')
    expect(err.message).toBe(
      '[plugin:test-plugin] Validation failed: Name is required',
    )
    expect(err.name).toBe('PluginValidationError')
    expect(err).toBeInstanceOf(PluginError)
  })
})

describe('PluginCompatibilityError', () => {
  it('should extend PluginError with compatibility prefix', () => {
    const err = new PluginCompatibilityError('test-plugin', 'Version mismatch')
    expect(err.message).toBe(
      '[plugin:test-plugin] Compatibility error: Version mismatch',
    )
    expect(err.name).toBe('PluginCompatibilityError')
    expect(err).toBeInstanceOf(PluginError)
  })
})

describe('PluginHookError', () => {
  it('should wrap an original error with hook context', () => {
    const original = new Error('Cannot read property of undefined')
    const err = new PluginHookError('test-plugin', 'beforeBuild', original)

    expect(err.message).toContain("Error in hook 'beforeBuild'")
    expect(err.message).toContain('Cannot read property of undefined')
    expect(err.hookName).toBe('beforeBuild')
    expect(err.pluginName).toBe('test-plugin')
    expect(err.cause).toBe(original)
    expect(err.name).toBe('PluginHookError')
  })

  it('should handle non-Error original errors', () => {
    const err = new PluginHookError(
      'test-plugin',
      'transformMdx',
      new Error(String('string error')),
    )
    expect(err.message).toContain("Error in hook 'transformMdx'")
  })
})
