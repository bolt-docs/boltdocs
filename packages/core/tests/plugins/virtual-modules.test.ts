import { describe, expect, it } from 'vitest'
import {
  generateClientRegistryModule,
  toClientPluginData,
  toClientRouteData,
} from '../../src/node/plugin/virtual-modules'
import { BoltdocsPluginSchema } from '../../src/node/schema/config'
import type { RouteMeta } from '../../src/node/routes/types'

describe('plugin client projection', () => {
  const plugin = {
    name: 'ask-ai',
    client: {
      slots: {
        'floating:after': '@bdocs/plugin-ask-ai/client#AskAiBubble',
      },
    },
    metadata: {
      endpoint: '/api/ask-ai',
      title: 'Docs Copilot',
      nested: { apiKey: 'must-not-leak', safeLabel: 'public' },
    },
  }

  it('preserves public plugin client configuration during validation', () => {
    const parsed = BoltdocsPluginSchema.parse(plugin)

    expect(parsed.client?.slots).toEqual(plugin.client.slots)
    expect(parsed.metadata).toEqual(plugin.metadata)
  })

  it('serializes only the public plugin name and metadata', () => {
    const parsed = BoltdocsPluginSchema.parse(plugin)

    expect(toClientPluginData(parsed)).toEqual({
      name: 'ask-ai',
      metadata: {
        endpoint: '/api/ask-ai',
        title: 'Docs Copilot',
        nested: { safeLabel: 'public' },
      },
    })
    expect(JSON.stringify(toClientPluginData(parsed))).not.toContain(
      'must-not-leak',
    )
  })

  it('generates an analyzable lazy import for a floating client slot', () => {
    const source = generateClientRegistryModule([
      BoltdocsPluginSchema.parse(plugin),
    ])

    expect(source).toContain('"floating:after"')
    expect(source).toContain('import("@bdocs/plugin-ask-ai/client")')
    expect(source).toContain('module["AskAiBubble"]')
  })
})

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
