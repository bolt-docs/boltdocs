import { describe, it, expect, vi } from 'vitest'

vi.mock('boltdocs', () => ({
  generateRoutes: vi.fn(async () => [{ path: '/docs/start', title: 'Start' }]),
}))

import { pickClientContext, resolvePageContext } from '../src/node/context'

describe('pickClientContext', () => {
  it('returns null for non-object bodies', () => {
    expect(pickClientContext(undefined, 100)).toBeNull()
    expect(pickClientContext('x', 100)).toBeNull()
  })

  it('caps page and content lengths', () => {
    const ctx = pickClientContext(
      { context: { page: 'p'.repeat(300), content: 'c'.repeat(10_000) } },
      100,
    )
    expect(ctx!.page).toHaveLength(256)
    expect(ctx!.content).toHaveLength(100)
  })

  it('returns null when context fields are missing', () => {
    expect(pickClientContext({ context: {} }, 100)).toBeNull()
  })
})

describe('resolvePageContext', () => {
  it('uses client context when provided', async () => {
    const result = await resolvePageContext({
      body: { context: { page: '/docs/x', content: 'hi' } },
      currentPage: '/docs/x',
      contextChars: 100,
      docsDir: '/docs',
    })
    expect(result.context).toEqual({ page: '/docs/x', content: 'hi' })
    expect(typeof result.elapsedMs).toBe('number')
  })

  it('resolves a matching doc route from the server', async () => {
    const result = await resolvePageContext({
      body: undefined,
      currentPage: '/docs/start',
      contextChars: 100,
      docsDir: '/docs',
    })
    expect(result.context).not.toBeNull()
    expect(result.context!.page).toBe('/docs/start')
  })
})
