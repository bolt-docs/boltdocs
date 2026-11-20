import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const mocks = vi.hoisted(() => ({
  resolveConfig: vi.fn(),
  createViteConfig: vi.fn(),
  inspectPluginsSecurity: vi.fn(),
  generateRoutes: vi.fn(),
  getExternalRoutePaths: vi.fn(),
}))

vi.mock('../../src/node/config', () => ({
  resolveConfig: mocks.resolveConfig,
}))
vi.mock('../../src/node/index', () => ({
  createViteConfig: mocks.createViteConfig,
}))
vi.mock('../../src/node/security/inspect', () => ({
  inspectPluginsSecurity: mocks.inspectPluginsSecurity,
}))
vi.mock('../../src/node/routes', () => ({
  generateRoutes: mocks.generateRoutes,
  getExternalRoutePaths: mocks.getExternalRoutePaths,
}))

import { ConfigResolveStep } from '../../src/node/pipeline/steps/config-resolve'
import type { BuildContext } from '../../src/node/pipeline/types'

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-config-resolve-'))
  vi.clearAllMocks()
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

const ctxFor = (overrides: Partial<BuildContext> = {}): BuildContext =>
  ({
    root,
    docsDir: 'docs',
    config: undefined,
    routes: [],
    ssgRoutes: [],
    routePaths: [],
    timing: {},
    outDir: 'dist',
    ...overrides,
  }) as BuildContext

describe('ConfigResolveStep', () => {
  it('resolves config, routes and vite config into the context', async () => {
    const config = { docsDir: 'docs', base: '/docs' } as any
    const routes = [
      { path: '/docs/api', filePath: 'docs/api.mdx', title: 'API' },
    ] as any
    const viteConfig = { build: {} } as any

    mocks.resolveConfig.mockResolvedValue(config)
    mocks.generateRoutes.mockResolvedValue(routes)
    mocks.getExternalRoutePaths.mockReturnValue(['/docs/showcase'])
    mocks.createViteConfig.mockResolvedValue(viteConfig)

    const ctx = ctxFor({ allCached: false })
    await new ConfigResolveStep().execute(ctx)

    expect(ctx.config).toBe(config)
    expect(ctx.docsDir).toBe(path.join(root, 'docs'))
    expect(ctx.routes).toBe(routes)
    expect(mocks.inspectPluginsSecurity).toHaveBeenCalledWith(config, root)
    expect(mocks.createViteConfig).toHaveBeenCalledWith(
      root,
      'production',
      config,
      { routes, skipTypes: true, skipLinkTree: true },
    )
    expect(ctx.viteConfig).toBe(viteConfig)
  })

  it('adds the base path and external route paths to routePaths', async () => {
    mocks.resolveConfig.mockResolvedValue({ docsDir: 'docs', base: '/docs' })
    mocks.generateRoutes.mockResolvedValue([{ path: '/docs/api' }])
    mocks.getExternalRoutePaths.mockReturnValue(['/docs/showcase', '/docs/api'])

    const ctx = ctxFor()
    await new ConfigResolveStep().execute(ctx)

    expect(ctx.routePaths).toContain('/docs')
    expect(ctx.routePaths).toContain('/docs/showcase')
    expect(ctx.routePaths).toContain('/docs/api')
    expect(new Set(ctx.routePaths).size).toBe(ctx.routePaths.length)
  })

  it('skips plugin security inspection on fully cached builds', async () => {
    mocks.resolveConfig.mockResolvedValue({ docsDir: 'docs' })
    mocks.generateRoutes.mockResolvedValue([])
    mocks.getExternalRoutePaths.mockReturnValue([])
    mocks.createViteConfig.mockResolvedValue({})

    const ctx = ctxFor({ allCached: true })
    await new ConfigResolveStep().execute(ctx)

    expect(mocks.inspectPluginsSecurity).not.toHaveBeenCalled()
  })
})
