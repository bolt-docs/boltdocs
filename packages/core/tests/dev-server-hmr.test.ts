import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

// The real satteri processor pulls in esbuild, which fails an invariant in
// the vitest environment (see the note in dev-server-watcher.test.ts). The
// HMR handler only needs the cache-invalidation helper, so mock the module
// and provide our own trivial MDX transform plugin for the dev server.
vi.mock('@bdocs/processor-satteri/node', () => ({
  invalidateMdxFileCache: vi.fn(),
}))

// These helpers write generated artifacts relative to process.cwd(); silence
// them so the tests never touch the real repository.
vi.mock('../src/node/types-generator', () => ({
  generateProjectTypes: vi.fn(),
  writeLinkTree: vi.fn(),
}))
vi.mock('../src/node/cli/doctor', () => ({
  generateLinkTree: vi.fn(async () => {}),
}))
const duiMocks = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('@bdocs/dui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bdocs/dui')>()
  return { ...actual, error: duiMocks.error }
})

import { createVirtualModulesPlugin } from '../src/node/plugin/virtual-modules'
import { createDevServerPlugin } from '../src/node/dev-server/index'
import { createPluginRuntimeState } from '../src/node/plugins/plugin-context'
import { getRouteCacheContext } from '../src/node/routes/cache'
import { normalizePath } from '../src/node/utils'
import type { Plugin } from 'vite'

interface TestServer {
  server: ViteDevServer
  wsSend: ReturnType<typeof vi.spyOn>
  invalidateModule: ReturnType<typeof vi.spyOn>
  vmPlugin: ReturnType<typeof createVirtualModulesPlugin>
  root: string
  docsDir: string
}

/**
 * Stub MDX plugin: turns every `.md`/`.mdx` file into a JS module that
 * exports the raw file content as a string. Enough to populate the module
 * graph so HMR invalidation and re-transforms are observable.
 */
function createStubMdxPlugin(): Plugin {
  return {
    name: 'test-stub-mdx',
    enforce: 'pre',
    load(id) {
      const [cleanId] = id.split('?')
      if (!/\.mdx?$/.test(cleanId)) return null
      const content = fs.readFileSync(cleanId, 'utf-8')
      return `export default ${JSON.stringify(content)}`
    },
  }
}

/** Minimal stand-in for `boltdocs/client` so the virtual entry loads. */
function createClientStub(root: string): string {
  const file = path.join(root, 'client-stub.mjs')
  fs.writeFileSync(
    file,
    [
      'export const ViteReactSSG = () => null',
      'export const createRoutes = () => ({})',
      'export const RouteRenderer = () => null',
      'export const matchRouteBranch = () => null',
      'export const matchRouteBranchWithParams = () => null',
      'export const resolveRouteBranch = () => null',
    ].join('\n'),
    'utf-8',
  )
  return normalizePath(file)
}

async function startDevServer(
  files: Record<string, string>,
): Promise<TestServer> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-hmr-it-'))
  const docsDir = path.join(root, 'docs')
  fs.mkdirSync(docsDir, { recursive: true })
  fs.writeFileSync(path.join(root, 'index.html'), '<div id="root"></div>')

  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(docsDir, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content, 'utf-8')
  }

  const clientStub = createClientStub(root)
  const config = {
    docsDir,
    theme: { title: 'HMR Test' },
    experimental: { fileRouting: true },
  }
  const runtime = createPluginRuntimeState()
  const cacheContext = getRouteCacheContext(docsDir)
  const getConfig = () => config as never
  const getViteConfig = () => ({ command: 'serve' as const }) as never

  const vmPlugin = createVirtualModulesPlugin(
    { docsDir, root },
    getConfig,
    getViteConfig,
    docsDir,
    runtime,
  )
  const devPlugin = createDevServerPlugin(
    docsDir,
    normalizePath(docsDir),
    getConfig,
    () => {},
    () => undefined,
    runtime,
    undefined,
    cacheContext,
  )

  const server = await createServer({
    root,
    logLevel: 'silent',
    server: { watch: { ignored: ['**/.boltdocs/**'] } },
    resolve: {
      alias: [{ find: 'boltdocs/client', replacement: clientStub }],
    },
    plugins: [createStubMdxPlugin(), vmPlugin, devPlugin],
  })

  // Wait until chokidar has actually established a watch on the docs
  // directory tree before returning. chokidar's `ready` event fires once the
  // top-level scan completes, but the per-directory fs.watch handles are
  // still being attached afterwards — a write that lands before a directory
  // is covered is silently swallowed (no change event is ever emitted),
  // which would make the HMR assertions flaky. Polling `getWatched()` until
  // every existing directory under docsDir appears as a key guarantees
  // subsequent writes to any test file are seen.
  const dirsToCover = new Set<string>([normalizePath(docsDir)])
  const collectDirs = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const child = path.join(dir, entry.name)
        dirsToCover.add(normalizePath(child))
        collectDirs(child)
      }
    }
  }
  collectDirs(docsDir)
  await new Promise<void>((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      const watched = server.watcher.getWatched() as Record<string, string[]>
      if ([...dirsToCover].every((dir) => watched[dir] !== undefined)) {
        clearInterval(timer)
        resolve()
        return
      }
      if (Date.now() - started > 5000) {
        clearInterval(timer)
        reject(
          new Error(
            `chokidar never covered all docs dirs; covered=${JSON.stringify(
              Object.keys(watched).filter((d) => d.includes('/docs')),
            )}`,
          ),
        )
      }
    }, 50)
  })

  const wsSend = vi.spyOn(server.ws, 'send')
  const invalidateModule = vi.spyOn(server.moduleGraph, 'invalidateModule')

  return { server, wsSend, invalidateModule, vmPlugin, root, docsDir }
}

/** Payload shape Vite passes to `ws.send` for both full-reload and custom events. */
interface WsPayload {
  type?: string
  event?: string
  data?: {
    relPath?: string
    file?: string
    routes?: { updated?: { path?: string; title?: string }[] }
    [key: string]: unknown
  }
}

/** Waits until `server.ws.send` was called with a payload matching `predicate`. */
async function waitForWsEvent(
  wsSend: TestServer['wsSend'],
  predicate: (payload: WsPayload) => boolean,
  timeoutMs = 8000,
): Promise<WsPayload> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const call = wsSend.mock.calls.find(([payload]) =>
      predicate(payload as WsPayload),
    )
    if (call) return call[0] as WsPayload
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`Timed out waiting for ws event (${timeoutMs}ms)`)
}

const serverList: TestServer[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const entry of serverList.splice(0)) {
    await entry.server.close()
    fs.rmSync(entry.root, { recursive: true, force: true })
  }
})

describe('dev server HMR integration', () => {
  it('re-transforms a modified MDX module and emits boltdocs:mdx-update', async () => {
    const ctx = await startDevServer({
      'index.mdx': '---\ntitle: Intro\n---\n# Hello v1\n',
    })
    serverList.push(ctx)

    // Warm up the module graph so the HMR handler can invalidate it.
    const warm = await ctx.server.transformRequest('/docs/index.mdx')
    expect(warm?.code).toContain('Hello v1')

    // Body-only change: same frontmatter, new content.
    fs.writeFileSync(
      path.join(ctx.docsDir, 'index.mdx'),
      '---\ntitle: Intro\n---\n# Hello v2\n',
      'utf-8',
    )

    const event = await waitForWsEvent(
      ctx.wsSend,
      (p) => p?.event === 'boltdocs:mdx-update',
    )
    expect(event).toMatchObject({
      type: 'custom',
      event: 'boltdocs:mdx-update',
    })
    expect(event.data?.relPath).toBe('index.mdx')
    expect(event.data?.file).toBe(
      normalizePath(path.join(ctx.docsDir, 'index.mdx')),
    )

    // No full reload for a body-only change.
    expect(ctx.wsSend.mock.calls.some(([p]) => p?.type === 'full-reload')).toBe(
      false,
    )

    // The module graph was invalidated and a fresh request returns the new
    // content — the page actually updates.
    await vi.waitFor(
      async () => {
        const fresh = await ctx.server.transformRequest('/docs/index.mdx')
        expect(fresh?.code).toContain('Hello v2')
        expect(fresh?.code).not.toContain('Hello v1')
      },
      { timeout: 5000 },
    )
  })

  it('emits boltdocs:mdx-update with the relative path of nested MDX files', async () => {
    const ctx = await startDevServer({
      'es/intro.mdx': '---\ntitle: Introducción\n---\n# Hola v1\n',
    })
    serverList.push(ctx)

    await ctx.server.transformRequest('/docs/es/intro.mdx')

    fs.writeFileSync(
      path.join(ctx.docsDir, 'es', 'intro.mdx'),
      '---\ntitle: Introducción\n---\n# Hola v2\n',
      'utf-8',
    )

    const event = await waitForWsEvent(
      ctx.wsSend,
      (p) => p?.event === 'boltdocs:mdx-update',
    )
    expect(event.data?.relPath).toBe('es/intro.mdx')
  })

  it('emits boltdocs:frontmatter-update with a delta when frontmatter changes', async () => {
    const ctx = await startDevServer({
      'guide.mdx': '---\ntitle: Guide v1\n---\n# Body\n',
    })
    serverList.push(ctx)

    await ctx.server.transformRequest('/docs/guide.mdx')

    // First change seeds the frontmatter hash baseline.
    fs.writeFileSync(
      path.join(ctx.docsDir, 'guide.mdx'),
      '---\ntitle: Guide v1\n---\n# Body updated\n',
      'utf-8',
    )
    await waitForWsEvent(ctx.wsSend, (p) => p?.event === 'boltdocs:mdx-update')
    ctx.wsSend.mockClear()

    // Frontmatter change: the title is different.
    fs.writeFileSync(
      path.join(ctx.docsDir, 'guide.mdx'),
      '---\ntitle: Guide v2\n---\n# Body updated\n',
      'utf-8',
    )

    const event = await waitForWsEvent(
      ctx.wsSend,
      (p) => p?.event === 'boltdocs:frontmatter-update',
    )
    expect(event).toMatchObject({ type: 'custom' })
    const updatedRoutes = event.data?.routes?.updated ?? []
    expect(updatedRoutes.length).toBeGreaterThan(0)
    const guide = updatedRoutes.find((r) => r.path === '/docs/guide')
    expect(guide).toBeDefined()
    expect(guide?.title).toBe('Guide v2')
  })

  it('emits full-reload and invalidates the entry when a pages-external file changes', async () => {
    const ctx = await startDevServer({
      'pages-external/roadmap.mdx': '# Roadmap v1\n',
    })
    serverList.push(ctx)

    // Load the virtual entry so its invalidation is observable.
    await ctx.server.transformRequest('\0virtual:boltdocs-entry.tsx')
    const entryModule = ctx.server.moduleGraph.getModuleById(
      '\0virtual:boltdocs-entry.tsx',
    )
    expect(entryModule).toBeDefined()
    const invalidateModuleSpy = ctx.invalidateModule
    const callsBefore = invalidateModuleSpy.mock.calls.length

    fs.writeFileSync(
      path.join(ctx.docsDir, 'pages-external', 'roadmap.mdx'),
      '# Roadmap v2\n',
      'utf-8',
    )

    const event = await waitForWsEvent(
      ctx.wsSend,
      (p) => p?.type === 'full-reload',
    )
    expect(event).toEqual({ type: 'full-reload' })

    // External pages never trigger the docs content-update event.
    expect(
      ctx.wsSend.mock.calls.some(([p]) => p?.event === 'boltdocs:mdx-update'),
    ).toBe(false)

    // The virtual entry module was invalidated in the module graph.
    await vi.waitFor(
      () => {
        const invalidated = invalidateModuleSpy.mock.calls
          .slice(callsBefore)
          .some(
            ([mod]) =>
              (mod as { id?: string })?.id === '\0virtual:boltdocs-entry.tsx',
          )
        expect(invalidated).toBe(true)
      },
      { timeout: 5000 },
    )
  })

  it('regenerates the entry when a pages-external file is added or removed', async () => {
    const ctx = await startDevServer({})
    serverList.push(ctx)
    const vmPlugin = ctx.vmPlugin

    const entryBefore = await vmPlugin.load!('\0virtual:boltdocs-entry.tsx')
    expect(entryBefore).not.toContain('roadmap')

    // Add a new external page. The directory does not exist yet — creating
    // it (and the file) must trigger the add-event path.
    fs.mkdirSync(path.join(ctx.docsDir, 'pages-external'), { recursive: true })
    fs.writeFileSync(
      path.join(ctx.docsDir, 'pages-external', 'roadmap.mdx'),
      '# Roadmap\n',
      'utf-8',
    )
    await waitForWsEvent(ctx.wsSend, (p) => p?.type === 'full-reload')

    const entryAfterAdd = await vmPlugin.load!('\0virtual:boltdocs-entry.tsx')
    expect(entryAfterAdd).toContain('roadmap.mdx')
    expect(entryAfterAdd).toContain('pages-external/roadmap.mdx')

    // Remove it again: the entry must drop the route.
    ctx.wsSend.mockClear()
    fs.rmSync(path.join(ctx.docsDir, 'pages-external', 'roadmap.mdx'))
    await waitForWsEvent(ctx.wsSend, (p) => p?.type === 'full-reload')

    const entryAfterRemove = await vmPlugin.load!(
      '\0virtual:boltdocs-entry.tsx',
    )
    expect(entryAfterRemove).not.toContain('roadmap.mdx')
  })

  it('suppresses Vite default HMR for docs content so a change emits exactly one reload', async () => {
    const ctx = await startDevServer({
      'index.mdx': '# Hello\n',
      'pages-external/roadmap.mdx': '# Roadmap\n',
    })
    serverList.push(ctx)

    // Warm both files into the module graph.
    await ctx.server.transformRequest('/docs/index.mdx')
    await ctx.server.transformRequest('/docs/pages-external/roadmap.mdx')

    // Change a docs page: exactly one custom mdx-update event, no full-reload
    // (Vite's own HMR is suppressed by createHotUpdateHandler).
    fs.writeFileSync(
      path.join(ctx.docsDir, 'index.mdx'),
      '# Hello 2\n',
      'utf-8',
    )
    await waitForWsEvent(ctx.wsSend, (p) => p?.event === 'boltdocs:mdx-update')
    expect(
      ctx.wsSend.mock.calls.filter(([p]) => p?.type === 'full-reload'),
    ).toEqual([])

    ctx.wsSend.mockClear()

    // Change an external page: exactly one full-reload, no duplicate.
    fs.writeFileSync(
      path.join(ctx.docsDir, 'pages-external', 'roadmap.mdx'),
      '# Roadmap 2\n',
      'utf-8',
    )
    await waitForWsEvent(ctx.wsSend, (p) => p?.type === 'full-reload')

    const reloads = ctx.wsSend.mock.calls.filter(
      ([p]) => p?.type === 'full-reload',
    )
    expect(reloads).toHaveLength(1)
    expect(
      ctx.wsSend.mock.calls.some(([p]) => p?.event === 'boltdocs:mdx-update'),
    ).toBe(false)
  })
})
