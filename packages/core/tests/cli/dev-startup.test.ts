import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const mocks = vi.hoisted(() => ({
  createServer: vi.fn(),
  createViteConfig: vi.fn(),
  resolveConfig: vi.fn(),
  inspectPluginsSecurity: vi.fn(),
  generateRoutes: vi.fn(),
  error: vi.fn(),
  devServer: vi.fn(() => 'dev server'),
  notifyUpdateAvailable: vi.fn(),
}))

vi.mock('@bdocs/ssg/node', () => ({
  createServer: mocks.createServer,
}))
vi.mock('../../src/node/index', () => ({
  createViteConfig: mocks.createViteConfig,
}))
vi.mock('../../src/node/config', () => ({
  resolveConfig: mocks.resolveConfig,
}))
vi.mock('../../src/node/security/inspect', () => ({
  inspectPluginsSecurity: mocks.inspectPluginsSecurity,
}))
vi.mock('../../src/node/routes', () => ({
  generateRoutes: mocks.generateRoutes,
}))
vi.mock('@bdocs/dui', () => ({
  error: mocks.error,
}))
vi.mock('../../src/node/ui-utils', () => ({
  devServer: mocks.devServer,
}))
vi.mock('../../src/node/update-check', () => ({
  notifyUpdateAvailable: mocks.notifyUpdateAvailable,
}))

import { devAction } from '../../src/node/cli/dev'

describe('devAction startup cleanup', () => {
  let root: string

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('closes the server and removes signal handlers when listen fails', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-dev-startup-'))
    const close = vi.fn(async () => {})
    const server = {
      close,
      listen: vi.fn(async () => {
        throw new Error('listen failed')
      }),
      httpServer: undefined,
      resolvedUrls: { local: [], network: [] },
      bindCLIShortcuts: vi.fn(),
    }

    mocks.resolveConfig.mockResolvedValue({})
    mocks.createViteConfig.mockResolvedValue({ server: {} })
    mocks.createServer.mockResolvedValue(server)
    mocks.generateRoutes.mockResolvedValue([])

    const processOnce = vi.spyOn(process, 'once')
    const processOff = vi.spyOn(process, 'off')
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    await expect(devAction(root)).rejects.toThrow('process.exit')

    expect(close).toHaveBeenCalledTimes(1)
    expect(processOnce).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(processOnce).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    expect(processOff).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(processOff).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    expect(fs.existsSync(path.join(root, '.boltdocs', 'dev-server.lock'))).toBe(
      false,
    )
  })

  it('releases the lock and resets the guard when server creation fails', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-dev-create-'))
    mocks.resolveConfig.mockResolvedValue({})
    mocks.createViteConfig.mockResolvedValue({ server: {} })
    mocks.createServer.mockRejectedValue(new Error('create failed'))
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    await expect(devAction(root)).rejects.toThrow('process.exit')
    expect(fs.existsSync(path.join(root, '.boltdocs', 'dev-server.lock'))).toBe(
      false,
    )

    await expect(devAction(root)).rejects.toThrow('process.exit')
    expect(mocks.createServer).toHaveBeenCalledTimes(2)
  })
})
