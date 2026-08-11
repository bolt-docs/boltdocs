import { describe, expect, it } from 'vitest'
import sassPlugin from '../src/node/index'

describe('Sass plugin', () => {
  it('maps modern load paths to Vite loadPaths', () => {
    const plugin = sassPlugin({
      api: 'modern',
      loadPaths: ['src/styles'],
    })

    expect(plugin.css?.preprocessorOptions?.scss).toEqual({
      api: 'modern',
      loadPaths: ['src/styles'],
    })
  })

  it('maps legacy paths to includePaths', () => {
    const plugin = sassPlugin({
      api: 'legacy',
      includePaths: ['src/styles'],
    })

    expect(plugin.css?.preprocessorOptions?.scss).toEqual({
      api: 'legacy',
      includePaths: ['src/styles'],
    })
  })
})
