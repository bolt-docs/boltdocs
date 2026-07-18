import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'

import {
  createPluginCachesAPI,
  createPluginDiagnosticsAPI,
  createPluginHmrAPI,
  createPluginMiddlewareAPI,
  createPluginPathsAPI,
  createPluginServerAPI,
  createPluginSlotsAPI,
  createPluginVirtualModulesAPI,
  invalidateMiddlewareCache,
  invalidateVirtualModule,
  invalidateVirtualModulesCache,
  runPluginHmrHandlers,
  runPluginServerStartCallbacks,
  runPluginServerEndCallbacks,
  setHmrSender,
  applyPluginServerMiddleware,
  __resetPluginContextStateForTests,
  virtualModuleRegistry,
  slotRegistry as programmaticSlotRegistry,
  middlewareRegistry,
} from '../../src/node/plugins/plugin-context'
import type { RouteMeta, PluginServerMiddleware } from '../../src/shared/types'

const ROOT = path.resolve(os.tmpdir(), 'boltdocs-plugin-context-tests')
const DOCS = path.join(ROOT, 'docs')

beforeEach(() => {
  __resetPluginContextStateForTests()
})

describe('createPluginCachesAPI.memory', () => {
  it('returns namespaced get/set/has with isolation across namespaces', () => {
    const caches = createPluginCachesAPI()
    const a = caches.memory<string>('plugin-a')
    const b = caches.memory<string>('plugin-b')

    a.set('k', 'value-a')
    expect(a.get('k')).toBe('value-a')
    expect(a.has('k')).toBe(true)

    // Plugin B cannot see plugin A's key despite identical key name.
    expect(b.get('k')).toBeUndefined()
    expect(b.has('k')).toBe(false)

    b.set('k', 'value-b')
    expect(a.get('k')).toBe('value-a')
    expect(b.get('k')).toBe('value-b')
  })

  it('respects max option (LRU eviction)', () => {
    const caches = createPluginCachesAPI()
    const store = caches.memory<string>('plugin-2', { max: 2 })
    store.set('a', '1')
    store.set('b', '2')
    store.set('c', '3')
    expect(store.has('a')).toBe(false)
    expect(store.has('b')).toBe(true)
    expect(store.has('c')).toBe(true)
  })
})

describe('createPluginCachesAPI.routes', () => {
  it('returns null for an unknown path', () => {
    const caches = createPluginCachesAPI()
    expect(caches.routes.get('/definitely/missing/route.md')).toBeNull()
  })

  it('set → get round-trips a RouteMeta', () => {
    const caches = createPluginCachesAPI()
    const route: RouteMeta = {
      path: '/docs/foo',
      componentPath: '/tmp/docs/foo.md',
      title: 'Foo',
      filePath: '/tmp/docs/foo.md',
    }
    caches.routes.set('/tmp/docs/foo.md', route)
    expect(caches.routes.get('/tmp/docs/foo.md')).toEqual(route)
  })

  it('invalidate and invalidateAll reset the entry', () => {
    const caches = createPluginCachesAPI()
    const route: RouteMeta = {
      path: '/docs/inv',
      componentPath: '/tmp/docs/inv.md',
      title: 'In',
      filePath: '/tmp/docs/inv.md',
    }
    caches.routes.set('/tmp/docs/inv.md', route)
    caches.routes.invalidate('/tmp/docs/inv.md')
    expect(caches.routes.get('/tmp/docs/inv.md')).toBeNull()
  })
})

describe('createPluginDiagnosticsAPI', () => {
  it('records report() entries and returns them via list()', () => {
    const dl = createPluginDiagnosticsAPI('plugin-x')
    dl.report('warn', 'X001', 'first warning')
    dl.report('error', 'X002', 'second warning', {
      filePath: '/tmp/x.md',
      routePath: '/docs/x',
    })
    const records = dl.list()
    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({
      severity: 'warn',
      code: 'X001',
      message: 'first warning',
      pluginName: 'plugin-x',
    })
    expect(records[1]).toMatchObject({
      severity: 'error',
      code: 'X002',
      message: 'second warning',
      filePath: '/tmp/x.md',
      routePath: '/docs/x',
    })
    expect(records.every((r) => r.id > 0)).toBe(true)
    expect(records.every((r) => r.time instanceof Date)).toBe(true)
  })

  it('list() returns a frozen array that does not mutate records on later reports', () => {
    const dl = createPluginDiagnosticsAPI('plugin-y')
    dl.report('info', 'Y001', 'first')
    const firstList = dl.list()
    dl.report('info', 'Y002', 'second')
    expect(firstList).toHaveLength(1)
    expect(dl.list()).toHaveLength(2)
  })

  it('FIFO cap evicts oldest records when the queue is overwhelmed', () => {
    const dl = createPluginDiagnosticsAPI('plugin-cap')
    // The cap is 256 in plugin-context.ts; emit 257 then confirm the
    // first one is no longer in the queue.
    for (let i = 0; i < 257; i++) {
      dl.report('info', `C${i}`, `record ${i}`)
    }
    const records = dl.list()
    expect(records.length).toBeLessThanOrEqual(256)
    // The first recorded code should be evicted (`C0`); `C256` should be the
    // newest one in the queue.
    expect(records.find((r) => r.code === 'C0')).toBeUndefined()
    expect(records[records.length - 1]!.code).toBe('C256')
  })

  it('clear() drops every record', () => {
    const dl = createPluginDiagnosticsAPI('plugin-z')
    dl.report('warn', 'Z001', 'one')
    dl.report('warn', 'Z002', 'two')
    expect(dl.list()).toHaveLength(2)
    dl.clear()
    expect(dl.list()).toHaveLength(0)
  })
})

describe('createPluginPathsAPI', () => {
  const paths = createPluginPathsAPI(DOCS, ROOT)

  it('resolveDocs joins and normalises paths under the docs dir', () => {
    const resolved = paths.resolveDocs('guides', 'index.mdx')
    expect(resolved).toBe(
      path.resolve(DOCS, 'guides', 'index.mdx').replace(/\\/g, '/'),
    )
  })

  it('resolveAsset joins and normalises paths under the project root', () => {
    const resolved = paths.resolveAsset('public', 'logo.svg')
    expect(resolved).toBe(
      path.resolve(ROOT, 'public', 'logo.svg').replace(/\\/g, '/'),
    )
  })

  it('rejects paths that escape the workspace boundary', () => {
    expect(() => paths.resolveDocs('..', '..', 'etc', 'passwd')).toThrow(
      /outside the workspace boundary/,
    )
    expect(() => paths.resolveAsset('..', 'package.json')).toThrow(
      /outside the workspace boundary/,
    )
  })

  it('rejects absolute-path escape through resolveDocs / resolveAsset', () => {
    // `path.resolve(baseDir, '/etc/passwd')` will collapse to `/etc/passwd`
    // on POSIX. Our validator must catch this even though the caller never
    // wrote `..` traversal segments.
    expect(() => paths.resolveDocs('/etc/passwd')).toThrow(
      /outside the workspace boundary/,
    )
    expect(() => paths.resolveAsset('/etc/passwd')).toThrow(
      /outside the workspace boundary/,
    )
  })

  it('safeFileURL produces a file:// URL with forward slashes', () => {
    const url = paths.safeFileURL(path.join(DOCS, 'index.mdx'))
    expect(url).toBe(
      `file://${path.join(DOCS, 'index.mdx').replace(/\\/g, '/')}`,
    )
  })
})

describe('createPluginVirtualModulesAPI', () => {
  it('register, has, list round-trip', () => {
    const api = createPluginVirtualModulesAPI()
    expect(api.list()).toHaveLength(0)

    api.add('virtual:plugin-foo/config', () => 'export default {};', {
      eager: true,
    })
    expect(api.has('virtual:plugin-foo/config')).toBe(true)
    expect(api.list()).toHaveLength(1)
    expect(api.list()[0]!.eager).toBe(true)
  })

  it('throws when colliding with an existing id', () => {
    const api = createPluginVirtualModulesAPI()
    api.add('virtual:plugin-bar/data', () => 'export default null;')
    expect(() =>
      api.add('virtual:plugin-bar/data', () => 'export default null;'),
    ).toThrow(/already registered/)
  })

  it('throws on ids inside the `virtual:boltdocs-` reserved prefix', () => {
    const api = createPluginVirtualModulesAPI()
    expect(() =>
      api.add('virtual:boltdocs-routes', () => 'export default null;'),
    ).toThrow(/reserved prefix/)
  })

  it('invalidateVirtualModulesCache and invalidateVirtualModule work', () => {
    const api = createPluginVirtualModulesAPI()
    api.add('virtual:plugin-c/a', () => 'A')
    api.add('virtual:plugin-c/b', () => 'B')
    expect(api.list()).toHaveLength(2)

    invalidateVirtualModule('virtual:plugin-c/a')
    expect(api.list()).toHaveLength(1)
    expect(api.list()[0]!.id).toBe('virtual:plugin-c/b')

    invalidateVirtualModulesCache()
    expect(api.list()).toHaveLength(0)
  })

  it('registry is process-wide and reset by __resetPluginContextStateForTests', () => {
    const api = createPluginVirtualModulesAPI()
    api.add('virtual:plugin-d/x', () => 'X')
    expect(virtualModuleRegistry.has('virtual:plugin-d/x')).toBe(true)

    __resetPluginContextStateForTests()
    expect(virtualModuleRegistry.has('virtual:plugin-d/x')).toBe(false)
  })
})

describe('createPluginSlotsAPI', () => {
  beforeEach(() => {
    __resetPluginContextStateForTests()
  })

  it('add, has, list round-trip', () => {
    const api = createPluginSlotsAPI()
    expect(api.list()).toHaveLength(0)
    expect(api.has('floating-bottom')).toBe(false)

    api.add('floating-bottom', {
      id: 'floating-bottom',
      modulePath: '@bdocs/plugin-ask-ai/client',
      component: 'AskAiBubble',
    })
    expect(api.has('floating-bottom')).toBe(true)
    expect(api.list()).toHaveLength(1)
    expect(api.list()[0]!.id).toBe('floating-bottom')
    expect(api.list()[0]!.modulePath).toBe('@bdocs/plugin-ask-ai/client')
  })

  it('remove clears the entry', () => {
    const api = createPluginSlotsAPI()
    api.add('right-rail', {
      id: 'right-rail',
      modulePath: '@bdocs/plugin-ask-ai/client',
    })
    expect(api.has('right-rail')).toBe(true)

    api.remove('right-rail')
    expect(api.has('right-rail')).toBe(false)
    expect(api.list()).toHaveLength(0)
  })

  it('registry is process-wide and reset by __resetPluginContextStateForTests', () => {
    const api = createPluginSlotsAPI()
    api.add('toc-extra', {
      id: 'toc-extra',
      modulePath: '@bdocs/plugin-ask-ai/client',
    })
    expect(programmaticSlotRegistry.has('toc-extra')).toBe(true)

    __resetPluginContextStateForTests()
    expect(programmaticSlotRegistry.has('toc-extra')).toBe(false)
  })

  it('works with export alias and clientEntry', () => {
    const api = createPluginSlotsAPI()
    api.add('header-extra', {
      id: 'header-extra',
      modulePath: '@bdocs/plugin-ask-ai/client',
      export: 'AskAiBanner',
    })
    const entry = api.list()[0]!
    expect(entry.export).toBe('AskAiBanner')
    // `export` and `component` are both accessible
    expect((entry as any).export).toBe('AskAiBanner')
  })
})

describe('createPluginHmrAPI', () => {
  beforeEach(() => {
    __resetPluginContextStateForTests()
  })

  it('registers file event handlers via onFileEvent and runPluginHmrHandlers invokes them', async () => {
    const api = createPluginHmrAPI()
    const handled: Array<{ eventType: string; filePath: string }> = []

    api.onFileEvent('change', (fp) => {
      handled.push({ eventType: 'change', filePath: fp })
    })
    api.onFileEvent('add', (fp) => {
      handled.push({ eventType: 'add', filePath: fp })
    })

    await runPluginHmrHandlers('change', '/docs/foo.md')
    expect(handled).toHaveLength(1)
    expect(handled[0]).toEqual({
      eventType: 'change',
      filePath: '/docs/foo.md',
    })

    await runPluginHmrHandlers('add', '/docs/bar.md')
    expect(handled).toHaveLength(2)
    expect(handled[1]).toEqual({ eventType: 'add', filePath: '/docs/bar.md' })
  })

  it('onFileAdd / onFileChange / onFileUnlink are shorthands for onFileEvent', async () => {
    const api = createPluginHmrAPI()
    const touched: string[] = []

    api.onFileAdd((fp) => touched.push(`add:${fp}`))
    api.onFileChange((fp) => touched.push(`change:${fp}`))
    api.onFileUnlink((fp) => touched.push(`unlink:${fp}`))

    await runPluginHmrHandlers('add', '/a.md')
    await runPluginHmrHandlers('change', '/b.md')
    await runPluginHmrHandlers('unlink', '/c.md')

    expect(touched).toEqual(['add:/a.md', 'change:/b.md', 'unlink:/c.md'])
  })

  it('multiple handlers on the same event type all run', async () => {
    const api = createPluginHmrAPI()
    const results: number[] = []

    api.onFileChange(() => {
      results.push(1)
    })
    api.onFileChange(() => {
      results.push(2)
    })
    api.onFileChange(() => {
      results.push(3)
    })

    await runPluginHmrHandlers('change', '/multi.md')
    expect(results).toEqual([1, 2, 3])
  })

  it('runPluginHmrHandlers is a no-op when no handlers are registered for the event type', async () => {
    await expect(
      runPluginHmrHandlers('change', '/none.md'),
    ).resolves.toBeUndefined()
  })

  it('handlers can be async and are awaited', async () => {
    const api = createPluginHmrAPI()
    let finished = false

    api.onFileChange(async (fp) => {
      await Promise.resolve()
      finished = true
    })

    await runPluginHmrHandlers('change', '/async.md')
    expect(finished).toBe(true)
  })

  it('send() broadcasts to the global _hmrSender when set', () => {
    const sent: Array<{ event: string; data?: unknown }> = []
    setHmrSender((event, data) => {
      sent.push({ event, data })
    })

    const api = createPluginHmrAPI()
    api.send('custom-event', { key: 'value' })

    expect(sent).toHaveLength(1)
    expect(sent[0].event).toBe('boltdocs:plugin:custom-event')
    expect(sent[0].data).toEqual({ key: 'value' })
  })

  it('send() is a no-op when no sender is set', () => {
    const api = createPluginHmrAPI()
    expect(() => api.send('test')).not.toThrow()
  })

  it('__resetPluginContextStateForTests clears hmrFileHandlers and _hmrSender', async () => {
    const api = createPluginHmrAPI()
    api.onFileChange(() => {})
    setHmrSender(() => {})

    __resetPluginContextStateForTests()

    // After reset, handlers are gone (no-op)
    await expect(
      runPluginHmrHandlers('change', '/after-reset.md'),
    ).resolves.toBeUndefined()

    // After reset, send is no-op (no sender)
    expect(() => api.send('after-reset')).not.toThrow()
  })
})

describe('createPluginServerAPI', () => {
  beforeEach(() => {
    __resetPluginContextStateForTests()
  })

  it('use() registers middleware that applyPluginServerMiddleware applies', () => {
    const api = createPluginServerAPI()
    const seen: string[] = []

    api.use((_req, _res, next) => {
      seen.push('mw1')
      next()
    })
    api.use((_req, _res, next) => {
      seen.push('mw2')
      next()
    })

    const middlewares: Array<(req: any, res: any, next: any) => void> = []
    const fakeServer = {
      middlewares: {
        use(fn: (req: any, res: any, next: any) => void) {
          middlewares.push(fn)
        },
      },
    }

    applyPluginServerMiddleware(fakeServer)
    expect(middlewares).toHaveLength(2)

    // Simulate running both middlewares
    middlewares[0]!(null, null, () => {})
    middlewares[1]!(null, null, () => {})
    expect(seen).toEqual(['mw1', 'mw2'])
  })

  it('useAt() wraps middleware with a path prefix check', () => {
    const api = createPluginServerAPI()
    const seen: string[] = []

    api.useAt('/api', (req, _res, next) => {
      seen.push(req.url!)
      next()
    })

    const middlewares: Array<(req: any, res: any, next: any) => void> = []
    const fakeServer = {
      middlewares: {
        use(fn: (req: any, res: any, next: any) => void) {
          middlewares.push(fn)
        },
      },
    }

    applyPluginServerMiddleware(fakeServer)
    expect(middlewares).toHaveLength(1)

    const mw = middlewares[0]!

    // Request matching /api prefix triggers the handler
    const matchingReq = { url: '/api/hello' }
    mw(matchingReq, null, () => {})
    expect(seen).toEqual(['/api/hello'])

    // Request not matching /api prefix passes through
    const nonMatchingReq = { url: '/docs' }
    let nextCalled = false
    mw(nonMatchingReq, null, () => {
      nextCalled = true
    })
    expect(nextCalled).toBe(true)
    // Handler was not called because path doesn't match
    expect(seen).toHaveLength(1)
  })

  it('onStart and onEnd callbacks run in registration order', async () => {
    const api = createPluginServerAPI()
    const order: string[] = []

    api.onStart(() => {
      order.push('start-1')
    })
    api.onStart(async () => {
      await Promise.resolve()
      order.push('start-2')
    })
    api.onEnd(() => {
      order.push('end-1')
    })
    api.onEnd(() => {
      order.push('end-2')
    })

    await runPluginServerStartCallbacks()
    expect(order).toEqual(['start-1', 'start-2'])

    await runPluginServerEndCallbacks()
    expect(order).toEqual(['start-1', 'start-2', 'end-1', 'end-2'])
  })

  it('onStart / onEnd callbacks are cleared by __resetPluginContextStateForTests', async () => {
    const api = createPluginServerAPI()
    let called = false
    api.onStart(() => {
      called = true
    })

    __resetPluginContextStateForTests()
    await runPluginServerStartCallbacks()
    expect(called).toBe(false)
  })

  it('applyPluginServerMiddleware applies nothing when no middleware registered', () => {
    const middlewares: any[] = []
    const fakeServer = {
      middlewares: {
        use(fn: any) {
          middlewares.push(fn)
        },
      },
    }

    applyPluginServerMiddleware(fakeServer)
    expect(middlewares).toHaveLength(0)
  })

  it('applyPluginServerMiddleware is idempotent — second call doubles registration if not reset', () => {
    const api = createPluginServerAPI()
    api.use((_req, _res, next) => {
      next()
    })

    const middlewares: any[] = []
    const fakeServer = {
      middlewares: {
        use(fn: any) {
          middlewares.push(fn)
        },
      },
    }

    applyPluginServerMiddleware(fakeServer)
    applyPluginServerMiddleware(fakeServer)
    // Both calls push — this is intentional: plugins control their own lifecycle
    expect(middlewares).toHaveLength(2)
  })
})

describe('createPluginMiddlewareAPI', () => {
  beforeEach(() => {
    __resetPluginContextStateForTests()
  })

  it('add, has, list, remove round-trip', () => {
    const api = createPluginMiddlewareAPI()
    expect(api.list()).toHaveLength(0)

    const mw: import('../../src/shared/types').PluginTransformMiddleware = {
      name: 'my-middleware',
      transformSource: (_ctx, { code }) => ({ code: code.toUpperCase() }),
    }
    api.add(mw)
    expect(api.has('my-middleware')).toBe(true)
    expect(api.list()).toHaveLength(1)

    api.remove('my-middleware')
    expect(api.has('my-middleware')).toBe(false)
    expect(api.list()).toHaveLength(0)
  })

  it('throws when adding a middleware with a duplicate name', () => {
    const api = createPluginMiddlewareAPI()
    api.add({
      name: 'dup',
      transformSource: (_ctx, { code }) => ({ code }),
    })
    expect(() =>
      api.add({
        name: 'dup',
        transformSource: (_ctx, { code }) => ({ code }),
      }),
    ).toThrow(/already registered/)
  })

  it('unnamed middleware gets an auto-generated key and does not collide', () => {
    const api = createPluginMiddlewareAPI()
    api.add({
      transformSource: (_ctx, { code }) => ({ code: code + 'a' }),
    })
    api.add({
      transformSource: (_ctx, { code }) => ({ code: code + 'b' }),
    })
    // Both unnamed middleware should be registered without error
    expect(api.list()).toHaveLength(2)
  })

  it('list() returns a frozen snapshot unaffected by later changes', () => {
    const api = createPluginMiddlewareAPI()
    api.add({
      name: 'first',
      transformSource: (_ctx, { code }) => ({ code }),
    })
    const snapshot = api.list()
    expect(snapshot).toHaveLength(1)

    api.add({
      name: 'second',
      transformSource: (_ctx, { code }) => ({ code }),
    })
    expect(snapshot).toHaveLength(1) // unchanged
    expect(api.list()).toHaveLength(2)
  })

  it('__resetPluginContextStateForTests clears middlewareRegistry', () => {
    const api = createPluginMiddlewareAPI()
    api.add({
      name: 'to-clear',
      transformSource: (_ctx, { code }) => ({ code }),
    })
    expect(api.list()).toHaveLength(1)

    __resetPluginContextStateForTests()
    expect(api.list()).toHaveLength(0)
  })

  it('invalidateMiddlewareCache clears all entries via named ESM import', () => {
    const api = createPluginMiddlewareAPI()
    api.add({ name: 'mw1', transformSource: (_ctx, { code }) => ({ code }) })
    api.add({ name: 'mw2', transformSource: (_ctx, { code }) => ({ code }) })
    expect(api.list()).toHaveLength(2)

    invalidateMiddlewareCache()
    expect(api.list()).toHaveLength(0)
  })
})
