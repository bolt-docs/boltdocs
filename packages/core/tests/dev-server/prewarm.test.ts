import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { BoltdocsConfig } from '../../src/node/config'
import { setupPrewarming } from '../../src/node/dev-server/prewarm'

describe('setupPrewarming', () => {
  type PrewarmServer = Parameters<typeof setupPrewarming>[0]
  let server: PrewarmServer
  let transformCalls: string[]
  let cacheDir: string

  beforeEach(() => {
    transformCalls = []
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-vite-'))
    fs.mkdirSync(path.join(cacheDir, 'deps'), { recursive: true })
    for (const file of [
      'react.js',
      'react-dom.js',
      'react-dom_client.js',
      'react-router-dom.js',
      'react-helmet-async.js',
    ]) {
      fs.writeFileSync(path.join(cacheDir, 'deps', file), '')
    }
    server = {
      config: {
        root: '/project',
        cacheDir,
      },
      warmupRequest: vi.fn((url: string) => {
        transformCalls.push(url)
        return Promise.resolve()
      }),
    } as unknown as PrewarmServer
  })

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true })
  })

  it('warm requests common dependencies immediately', async () => {
    const close = () => ({}) as BoltdocsConfig
    const docsDir = '/project/docs'
    // Use a routesPromise that resolves immediately to avoid filesystem.
    const routesPromise = Promise.resolve([])
    setupPrewarming(server, docsDir, close, routesPromise)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    // Dependency warming requests real optimized-dep URLs through Vite's
    // public warmup API.
    expect(transformCalls.some((u) => u.includes('react-router-dom'))).toBe(
      true,
    )
  })
})
