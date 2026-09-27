import { describe, expect, it } from 'vitest'
import {
  CONTRACTS_API_VERSION,
  type InvalidationEvent,
  type ModuleIdentity,
  type RouteMeta,
} from '../src'

describe('@bdocs/contracts', () => {
  it('exposes a versioned contract surface', () => {
    expect(CONTRACTS_API_VERSION).toBe(1)
  })

  it('describes a route without framework dependencies', () => {
    const route: RouteMeta = {
      path: '/docs/intro',
      componentPath: '/project/docs/intro.mdx',
      title: 'Intro',
      filePath: 'intro.mdx',
      headings: [{ level: 2, text: 'Install', id: 'install' }],
    }

    expect(route.path).toBe('/docs/intro')
    expect(route.headings?.[0]?.id).toBe('install')
  })

  it('supports incremental module identities and invalidation events', () => {
    const identity: ModuleIdentity = {
      sourceHash: 'sha256:page',
      routePath: '/docs/intro',
      clientDeps: ['client:intro'],
      serverDeps: ['server:intro'],
      cssDeps: ['css:site'],
      pluginDeps: ['plugin:search'],
    }
    const event: InvalidationEvent = {
      kind: 'content',
      filePath: '/project/docs/intro.mdx',
      routePath: '/docs/intro',
      moduleIds: ['client:intro'],
    }

    expect(identity.clientDeps).toEqual(['client:intro'])
    expect(event.kind).toBe('content')
  })
})
