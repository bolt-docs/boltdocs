import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupPrewarming } from '../../src/node/dev-server/prewarm'

describe('setupPrewarming', () => {
  let server: any
  let transformCalls: string[]

  beforeEach(() => {
    transformCalls = []
    server = {
      transformRequest: vi.fn((url: string) => {
        transformCalls.push(url)
        return Promise.resolve()
      }),
    }
  })

  it('warm requests common dependencies immediately', () => {
    const close = () => ({ config: { docsDir: 'docs' } }) as any
    const docsDir = '/project/docs'
    // Use a routesPromise that resolves immediately to avoid filesystem.
    const routesPromise = Promise.resolve([])
    setupPrewarming(server, docsDir, close, routesPromise)
    // Dependency warming is synchronous-ish (transformRequest is called);
    // assert the known dependency entries were requested.
    expect(transformCalls.some((u) => u.includes('react-router-dom'))).toBe(
      true,
    )
  })
})
