import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.doUnmock('beasties')
  vi.doUnmock('@bdocs/zig-critters')
})

describe('critical dependency wrappers', () => {
  it('returns undefined when beastsies cannot be imported', async () => {
    vi.doMock('beasties', () => {
      throw new Error('missing')
    })
    const { getBeasties } = await import('../src/node/critical')
    expect(await getBeasties('/out')).toBeUndefined()
  })

  it('returns undefined when zig-critters exposes no processHtml', async () => {
    vi.doMock('@bdocs/zig-critters', () => ({}))
    const { getZigCritters } = await import('../src/node/critical')
    expect(await getZigCritters()).toBeUndefined()
  })
})
