import { describe, expect, it, vi } from 'vitest'

const contexts = vi.hoisted(
  () => [] as Array<{ disposed: boolean; variants: Map<string, unknown> }>,
)

vi.mock('../../src/node/routes', () => ({
  generateRoutes: vi.fn(async () => []),
}))

vi.mock('../../src/node/routes/cache', () => ({
  getRouteCacheContext: vi.fn(() => {
    const ctx = { disposed: false, variants: new Map<string, unknown>() }
    contexts.push(ctx)
    return ctx
  }),
  getRouteCacheVariant: vi.fn(
    (context: { variants: Map<string, unknown> }, fingerprint: string) => {
      let variant = context.variants.get(fingerprint)
      if (!variant) {
        variant = { fingerprint, cachedFileList: null }
        context.variants.set(fingerprint, variant)
      }
      return variant
    },
  ),
  getRouteGenerationFingerprint: () => 'test-fingerprint',
}))

import {
  computeFrontmatterDelta,
  createVirtualModuleState,
} from '../../src/node/plugin/virtual-modules'

describe('route cache context self-healing', () => {
  it('replaces a disposed context on the next virtual module generation', async () => {
    const docsDir = '/tmp/docs'
    const state = createVirtualModuleState()

    await computeFrontmatterDelta(docsDir, {} as never, state)
    expect(state.routeCacheContext).toBe(contexts[0])
    expect(state.routeCacheContext?.disposed).toBe(false)

    state.routeCacheContext!.disposed = true
    await computeFrontmatterDelta(docsDir, {} as never, state)

    expect(contexts).toHaveLength(2)
    expect(state.routeCacheContext).toBe(contexts[1])
    expect(state.routeCacheContext?.disposed).toBe(false)
    expect(state.routeGenerationFingerprint).toBe('test-fingerprint')
  })
})
