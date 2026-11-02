import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `hmr-handler` pulls in the route generator, the MDX cache and the plugin
 * runtime. None of that is under test here, so it is mocked out: importing it
 * unmocked also drags esbuild into the environment, which the vitest config
 * cannot load.
 */
const mocks = vi.hoisted(() => ({
  invalidateMdxFileCache: vi.fn(),
  invalidateRouteCache: vi.fn(),
  invalidateFile: vi.fn(),
  invalidateDirectoryMetaCache: vi.fn(),
  invalidateVirtualModule: vi.fn(),
  runPluginHmrHandlers: vi.fn(async () => {}),
  generateProjectTypes: vi.fn(),
  generateRoutes: vi.fn(async () => []),
  getExternalRoutePaths: vi.fn(() => []),
  error: vi.fn(),
  delay: vi.fn(async () => {}),
}))

vi.mock('@bdocs/processor-satteri/node', () => ({
  invalidateMdxFileCache: mocks.invalidateMdxFileCache,
}))
vi.mock('../src/node/routes', () => ({
  invalidateRouteCache: mocks.invalidateRouteCache,
  invalidateFile: mocks.invalidateFile,
  generateRoutes: mocks.generateRoutes,
  getExternalRoutePaths: mocks.getExternalRoutePaths,
}))
vi.mock('../src/node/routes/cache', () => ({
  getRouteGenerationFingerprint: vi.fn(() => 'fp'),
  getRouteCacheContext: vi.fn(),
  getRouteCacheVariant: vi.fn(),
  invalidateDirectoryMetaFile: vi.fn(),
}))
vi.mock('../src/node/plugin/virtual-modules', () => ({
  computeFrontmatterDelta: vi.fn(),
  computeFrontmatterHash: vi.fn(() => 'hash'),
  getFrontmatterHash: vi.fn(),
  setFrontmatterHash: vi.fn(),
  removeFrontmatterHash: vi.fn(),
  invalidateDirectoryMetaCache: mocks.invalidateDirectoryMetaCache,
}))
vi.mock('../src/node/plugins/plugin-context', () => ({
  runPluginHmrHandlers: mocks.runPluginHmrHandlers,
}))
vi.mock('../src/node/types-generator', () => ({
  generateProjectTypes: mocks.generateProjectTypes,
}))
vi.mock('../src/node/route-paths', () => ({
  buildTypeRoutePaths: vi.fn(() => []),
}))
vi.mock('../src/node/dev-server/external-page-rewrite', () => ({
  invalidateExternalPagePaths: vi.fn(),
}))
vi.mock('../src/node/cli/doctor', () => ({ generateLinkTree: vi.fn() }))
vi.mock('@bdocs/dui', () => ({ error: mocks.error }))

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-hmr-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  vi.clearAllMocks()
})

// Imported once: the dynamic import pulls the module graph on the first call,
// which is cold and can exceed the default budget under full-suite load.
let testing: typeof import('../src/node/dev-server/hmr-handler').__testing

beforeAll(async () => {
  testing = (await import('../src/node/dev-server/hmr-handler')).__testing
}, 30_000)

describe('isWriteInProgress', () => {
  it('is true for a file that is currently empty', () => {
    const file = path.join(root, 'page.mdx')
    fs.writeFileSync(file, '')

    expect(testing.isWriteInProgress(file)).toBe(true)
  })

  it('is true for a file holding only whitespace', () => {
    const file = path.join(root, 'page.mdx')
    fs.writeFileSync(file, '   \n\t\n')

    expect(testing.isWriteInProgress(file)).toBe(true)
  })

  it('is false once the file has content', () => {
    const file = path.join(root, 'page.mdx')
    fs.writeFileSync(file, '---\ntitle: T\n---\n\nBody\n')

    expect(testing.isWriteInProgress(file)).toBe(false)
  })

  it('is false for a file that no longer exists', () => {
    // A real deletion must not be mistaken for a save in progress: add/unlink
    // handle that case separately.
    expect(testing.isWriteInProgress(path.join(root, 'gone.mdx'))).toBe(false)
  })

  it('follows a truncate-then-write cycle', () => {
    const file = path.join(root, 'page.mdx')

    fs.writeFileSync(file, '---\ntitle: T\n---\n\nBody\n')
    expect(testing.isWriteInProgress(file)).toBe(false)

    fs.writeFileSync(file, '')
    expect(testing.isWriteInProgress(file)).toBe(true)

    fs.writeFileSync(file, '---\ntitle: T2\n---\n\nBody\n')
    expect(testing.isWriteInProgress(file)).toBe(false)
  })
})
