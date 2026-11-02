import { describe, expect, it } from 'vitest'
import {
  createRenderPlans,
  getRenderPlan,
} from '../src/node/pipeline/render-plan'

describe('createRenderPlans', () => {
  const input = {
    routes: ['/docs', '/docs/guide/'],
    outDir: '/tmp/dist',
    ssgPagesDir: '/tmp/cache/ssg-pages',
    dirStyle: 'flat' as const,
    base: '/docs',
    contextBase: '/docs/',
    fallbackHash: 'global-hash',
    routeToSourceFileMap: {
      '/docs': '/project/docs/index.mdx',
      '/docs/guide': '/project/docs/guide.mdx',
    },
    sourceMeta: new Map([
      ['/project/docs/index.mdx', { hash: 'index-hash', mtimeMs: 12 }],
      ['/project/docs/guide.mdx', { hash: 'guide-hash', mtimeMs: 24 }],
    ]),
    routeToAssetHash: {
      '/docs': 'index-assets',
      '/docs/guide/': 'guide-assets',
    },
  }

  it('precomputes stable cache and output paths', () => {
    const plans = createRenderPlans(input)
    const root = getRenderPlan(plans, '/docs')
    const guide = getRenderPlan(plans, '/docs/guide/')

    expect(root.normalizedKey).toBe('/docs')
    expect(root.cachedHtmlFile).toMatch(/\/ssg-pages\/[a-f0-9]{32}\.html$/)
    expect(root.finalOutFile).toBe('/tmp/dist/docs.html')
    expect(root.sourceContentHash).toBe('index-hash')
    expect(root.routeAssetHash).toBe('index-assets')
    expect(root.fetchUrl).toBe('/docs/docs')

    expect(guide.normalizedKey).toBe('/docs/guide')
    expect(guide.finalOutFile).toBe('/tmp/dist/docs/guide/index.html')
    expect(guide.sourceContentHash).toBe('guide-hash')
    expect(guide.routeAssetHash).toBe('guide-assets')
  })

  it('freezes each plan and fails clearly for missing routes', () => {
    const plans = createRenderPlans(input)
    const plan = getRenderPlan(plans, '/docs')
    expect(Object.isFrozen(plan)).toBe(true)
    expect(() => getRenderPlan(plans, '/missing')).toThrow(
      'Missing render plan for route: /missing',
    )
  })

  it('uses fallback metadata for synthetic routes', () => {
    const plans = createRenderPlans({
      ...input,
      routes: ['/'],
      routeToSourceFileMap: {},
      routeToAssetHash: {},
    })
    const plan = getRenderPlan(plans, '/')
    expect(plan.normalizedKey).toBe('')
    expect(plan.sourceContentHash).toBe('global-hash')
    expect(plan.routeAssetHash).toBe('global-hash')
    expect(plan.finalOutFile).toBe('/tmp/dist/index.html')
  })
})
