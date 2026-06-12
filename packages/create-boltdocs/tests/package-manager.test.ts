import { describe, it, expect, afterEach } from 'vitest'

import { getPackageManager } from '../src/utils/package-manager'

describe('packageManager utility', () => {
  const originalUserAgent = process.env.npm_config_user_agent

  afterEach(() => {
    process.env.npm_config_user_agent = originalUserAgent
  })

  it('should detect pnpm', () => {
    process.env.npm_config_user_agent = 'pnpm/10.30.2 npm/? node/v22.0.0'
    expect(getPackageManager()).toBe('pnpm')
  })

  it('should detect yarn', () => {
    process.env.npm_config_user_agent = 'yarn/1.22.19 npm/? node/v22.0.0'
    expect(getPackageManager()).toBe('yarn')
  })

  it('should detect bun', () => {
    process.env.npm_config_user_agent = 'bun/1.1.0 npm/? node/v22.0.0'
    expect(getPackageManager()).toBe('bun')
  })

  it('should fallback to npm', () => {
    process.env.npm_config_user_agent = undefined
    expect(getPackageManager()).toBe('npm')
  })
})
