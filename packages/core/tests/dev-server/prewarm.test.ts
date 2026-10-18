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
    vi.useFakeTimers()
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
    vi.useRealTimers()
    fs.rmSync(cacheDir, { recursive: true, force: true })
  })

  it('does not warm dependencies synchronously', () => {
    const close = () => ({}) as BoltdocsConfig
    const routesPromise = Promise.resolve([])
    setupPrewarming(server, '/project/docs', close, routesPromise)
    // Warming is deferred so it cannot race Vite's dep optimizer, which may
    // still be rewriting the cache on the first start after a version bump.
    expect(transformCalls).toHaveLength(0)
  })

  it('warms common dependencies after the startup delay', async () => {
    const close = () => ({}) as BoltdocsConfig
    const docsDir = '/project/docs'
    // Use a routesPromise that resolves immediately to avoid filesystem.
    const routesPromise = Promise.resolve([])
    setupPrewarming(server, docsDir, close, routesPromise)
    await vi.advanceTimersByTimeAsync(1600)
    // Dependency warming requests real optimized-dep URLs through Vite's
    // public warmup API.
    expect(transformCalls.some((u) => u.includes('react-router-dom'))).toBe(
      true,
    )
  })

  it('skips optimized deps whose shared chunk is missing', async () => {
    const depsDir = path.join(cacheDir, 'deps')
    // A dep written by a previous run references a chunk the optimizer has
    // already deleted; warming it is what produced the pre-transform error.
    fs.writeFileSync(
      path.join(depsDir, 'react.js'),
      'import { t } from "./rolldown-runtime-missing.js"\n',
    )
    const close = () => ({}) as BoltdocsConfig
    const routesPromise = Promise.resolve([])
    setupPrewarming(server, '/project/docs', close, routesPromise)
    await vi.advanceTimersByTimeAsync(1600)
    expect(transformCalls.some((u) => u.endsWith('/react.js'))).toBe(false)
    // Consistent deps are still warmed.
    expect(transformCalls.some((u) => u.includes('react-router-dom'))).toBe(
      true,
    )
  })
})
