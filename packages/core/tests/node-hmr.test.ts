import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invalidateMdxFileCache: vi.fn(),
  invalidateRouteCache: vi.fn(),
  invalidateFile: vi.fn(),
  invalidateDirectoryMetaCache: vi.fn(),
  invalidateVirtualModulesCache: vi.fn(),
  runPluginHmrHandlers: vi.fn(async () => {}),
  generateProjectTypes: vi.fn(),
  generateLinkTree: vi.fn(async () => {}),
  error: vi.fn(),
}))

vi.mock('@bdocs/processor-satteri/node', () => ({
  invalidateMdxFileCache: mocks.invalidateMdxFileCache,
}))
vi.mock('../src/node/routes', () => ({
  invalidateRouteCache: mocks.invalidateRouteCache,
  invalidateFile: mocks.invalidateFile,
  invalidateDirectoryMetaFile: vi.fn(),
}))
vi.mock('../src/node/plugin/virtual-modules', () => ({
  computeFrontmatterDelta: vi.fn(),
  invalidateDirectoryMetaCache: mocks.invalidateDirectoryMetaCache,
}))
vi.mock('../src/node/plugins/plugin-context', () => ({
  invalidateVirtualModulesCache: mocks.invalidateVirtualModulesCache,
  runPluginHmrHandlers: mocks.runPluginHmrHandlers,
}))
vi.mock('../src/node/types-generator', () => ({
  generateProjectTypes: mocks.generateProjectTypes,
}))
vi.mock('../src/node/cli/doctor', () => ({
  generateLinkTree: mocks.generateLinkTree,
}))
vi.mock('@bdocs/dui', () => ({ error: mocks.error }))

import {
  createHotUpdateHandler,
  setupHmr,
} from '../src/node/dev-server/hmr-handler'

type WatcherEvent = (file: string) => void

describe('setupHmr translated MDX updates', () => {
  let tempRoot: string | undefined

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true })
    tempRoot = undefined
  })

  it('does not treat a sibling directory as part of docsDir', () => {
    const handler = createHotUpdateHandler('/project/docs')

    expect(handler?.({ file: '/project/docs/es/intro.mdx' } as never)).toEqual(
      [],
    )
    expect(
      handler?.({ file: '/project/docs-other/es/intro.mdx' } as never),
    ).toBe(undefined)
  })

  it('cancels a pending change when the document is unlinked', async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-hmr-'))
    const docsDir = path.join(tempRoot, 'docs')
    const file = path.join(docsDir, 'es', 'removed.mdx')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '# Removed\n')

    const watcherHandlers = new Map<string, WatcherEvent>()
    const server = {
      watcher: {
        on: vi.fn((event: string, handler: WatcherEvent) => {
          watcherHandlers.set(event, handler)
        }),
      },
      moduleGraph: {
        getModulesByFile: vi.fn(() => new Set()),
        fileToModulesMap: new Map(),
        invalidateModule: vi.fn(),
        getModuleById: vi.fn(() => undefined),
      },
      ws: { send: vi.fn() },
      restart: vi.fn(),
    }

    setupHmr(
      server as never,
      docsDir,
      docsDir.replace(/\\/g, '/'),
      () => ({}) as never,
    )

    watcherHandlers.get('change')?.(file)
    watcherHandlers.get('unlink')?.(file)
    await vi.advanceTimersByTimeAsync(220)

    expect(mocks.invalidateFile).not.toHaveBeenCalled()
    expect(mocks.invalidateMdxFileCache).not.toHaveBeenCalled()
    expect(mocks.invalidateVirtualModulesCache).not.toHaveBeenCalled()
    expect(mocks.runPluginHmrHandlers).toHaveBeenCalledWith(
      'unlink',
      file.replace(/\\\\/g, '/'),
    )
  })

  it('invalidates and emits the canonical relative path for a translated MDX change', async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-hmr-'))
    const docsDir = path.join(tempRoot, 'docs')
    const translatedFile = path.join(docsDir, 'es', 'intro.mdx')
    fs.mkdirSync(path.dirname(translatedFile), { recursive: true })
    fs.writeFileSync(translatedFile, '# Introducción\n')

    const watcherHandlers = new Map<string, WatcherEvent>()
    const module = { id: translatedFile }
    const server = {
      watcher: {
        on: vi.fn((event: string, handler: WatcherEvent) => {
          watcherHandlers.set(event, handler)
        }),
      },
      moduleGraph: {
        getModulesByFile: vi.fn(() => new Set([module])),
        fileToModulesMap: new Map(),
        invalidateModule: vi.fn(),
        getModuleById: vi.fn(() => undefined),
      },
      ws: { send: vi.fn() },
      restart: vi.fn(),
    }

    setupHmr(
      server as never,
      docsDir,
      docsDir.replace(/\\/g, '/'),
      () => ({}) as never,
    )

    const changeHandler = watcherHandlers.get('change')
    expect(changeHandler).toBeDefined()
    changeHandler?.(translatedFile)
    await vi.advanceTimersByTimeAsync(220)
    vi.useRealTimers()

    await vi.waitFor(() => {
      expect(mocks.invalidateFile).toHaveBeenCalledWith(
        translatedFile,
        expect.objectContaining({ docsDir }),
      )
    })
    expect(mocks.invalidateMdxFileCache).toHaveBeenCalledWith(translatedFile)
    expect(mocks.runPluginHmrHandlers).toHaveBeenCalledWith(
      'change',
      translatedFile.replace(/\\\\/g, '/'),
    )
    expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith(module)
    expect(server.ws.send).toHaveBeenCalledWith({
      type: 'custom',
      event: 'boltdocs:mdx-update',
      data: {
        file: translatedFile.replace(/\\/g, '/'),
        relPath: 'es/intro.mdx',
      },
    })
  })
})
