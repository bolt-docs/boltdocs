import { describe, it, expect } from 'vitest'
import { buildModuleMap } from '../../src/client/ssg/create-routes.utils'

describe('buildModuleMap', () => {
  it('maps localized file paths to combined.mjs keys', () => {
    const mdxModules = {
      '/docs/(guides)/index.mdx': { default: () => 'en' },
      '/docs/es/(guides)/index.mdx': { default: () => 'es' },
      '/docs/(api)/cli.mdx': { default: () => 'en cli' },
      '/docs/es/(api)/cli.mdx': { default: () => 'es cli' },
    }

    const moduleMap = buildModuleMap(mdxModules)

    expect(moduleMap.get('(guides)/index.mdx')).toBe('/docs/(guides)/index.mdx')
    expect(moduleMap.get('es/(guides)/index.mdx')).toBe(
      '/docs/es/(guides)/index.mdx',
    )
    expect(moduleMap.get('(api)/cli.mdx')).toBe('/docs/(api)/cli.mdx')
    expect(moduleMap.get('es/(api)/cli.mdx')).toBe('/docs/es/(api)/cli.mdx')
  })

  it('maps import.meta.glob style keys', () => {
    const mdxModules = {
      '/docs/guides/index.mdx': () => Promise.resolve({ default: () => 'en' }),
      '/docs/es/guides/index.mdx': () =>
        Promise.resolve({ default: () => 'es' }),
    }

    const moduleMap = buildModuleMap(mdxModules)

    expect(moduleMap.get('guides/index.mdx')).toBe('/docs/guides/index.mdx')
    expect(moduleMap.get('es/guides/index.mdx')).toBe(
      '/docs/es/guides/index.mdx',
    )
  })
})
