import { describe, expect, it } from 'vitest'
import { toClientRouteData } from '../../src/node/plugin/virtual-modules'
import type { RouteMeta } from '../../src/node/routes/types'

describe('virtual route client projection', () => {
  it('preserves client metadata and omits server-only route fields', () => {
    const route: RouteMeta = {
      path: '/docs/guide',
      componentPath: '/project/docs/guide.md',
      filePath: 'guide.md',
      title: 'Guide',
      frontmatter: { custom: 'value' },
      featureFlags: ['beta'],
      _content: 'plain text',
      _rawContent: '# Guide',
    }

    const projected = toClientRouteData(route)

    expect(projected).toMatchObject({
      path: '/docs/guide',
      filePath: 'guide.md',
      title: 'Guide',
      description: '',
      headings: [],
      frontmatter: { custom: 'value' },
    })
    expect(projected).not.toHaveProperty('componentPath')
    expect(projected).not.toHaveProperty('_content')
    // Raw markdown is served via the lazy page-source.json asset, never
    // embedded in the shared routes module (it would put every page's full
    // MDX text into app-*.js and force global render invalidation on edits).
    expect(projected).not.toHaveProperty('_rawContent')
    expect(projected).not.toHaveProperty('featureFlags')
  })
})
