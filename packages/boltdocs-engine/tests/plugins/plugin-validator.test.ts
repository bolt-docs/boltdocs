import { describe, it, expect } from 'vitest'
import {
  validatePlugins,
  PluginValidationError,
  PluginCompatibilityError,
} from '../../src/node/plugins'

describe('Plugin Validator', () => {
  const boltdocsVersion = '1.0.0'

  it('should accept a valid plugin', () => {
    const plugins = [{ name: 'test-plugin' }]
    const validated = validatePlugins(plugins, boltdocsVersion)
    expect(validated).toHaveLength(1)
    expect(validated[0].name).toBe('test-plugin')
  })

  it('should reject a plugin without a name', () => {
    const plugins = [{ enforce: 'pre' }]
    expect(() => validatePlugins(plugins, boltdocsVersion)).toThrow(
      PluginValidationError,
    )
  })

  it('should reject duplicate plugin names', () => {
    const plugins = [{ name: 'dup' }, { name: 'dup' }]
    expect(() => validatePlugins(plugins, boltdocsVersion)).toThrow(
      'Duplicate plugin name',
    )
  })

  it('should reject incompatible boltdocs version', () => {
    const plugins = [{ name: 'new-plugin', boltdocsVersion: '^2.0.0' }]
    expect(() => validatePlugins(plugins, boltdocsVersion)).toThrow(
      PluginCompatibilityError,
    )
  })

  it('should reject path traversal in component paths', () => {
    const plugins = [
      {
        name: 'evil',
        components: { Evil: '../../etc/passwd' },
      },
    ]
    expect(() => validatePlugins(plugins, boltdocsVersion)).toThrow(
      'traversal sequences are not allowed',
    )
  })

  it('should accept plugin with hooks', () => {
    const plugins = [
      {
        name: 'hook-plugin',
        hooks: {
          beforeBuild: async () => {},
          afterBuild: async () => {},
          transformMdx: async (_ctx: any, params: any) => params,
        },
      },
    ]
    const validated = validatePlugins(plugins, boltdocsVersion)
    expect(validated[0].hooks?.beforeBuild).toBeDefined()
    expect(validated[0].hooks?.transformMdx).toBeDefined()
  })

  it('preserves modern lifecycle hooks during validation', () => {
    const buildBefore = async () => {}
    const plugins = [
      {
        name: 'modern-hook-plugin',
        hooks: {
          'build:before': buildBefore,
          'server:configure': async () => {},
        },
      },
    ]

    const validated = validatePlugins(plugins, boltdocsVersion)

    expect(validated[0].hooks?.['build:before']).toBe(buildBefore)
    expect(validated[0].hooks?.['server:configure']).toBeDefined()
  })
})
