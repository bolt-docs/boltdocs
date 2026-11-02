import { describe, it, expect } from 'vitest'
import { getBeasties, getZigCritters } from '../src/node/critical'

/**
 * The wrappers resolve their dependency lazily, so a test decides what "the
 * package" is by handing them a loader.
 *
 * These cases used to mock the module specifier instead, with `vi.doMock` plus
 * `vi.resetModules()`. That only works if the mock is registered before the
 * target module enters the module graph, and the failure mode was silent: when
 * another test file in the same worker had already imported it, the mock did
 * not apply and the assertion ran against the real package. It passed alone and
 * failed roughly half the time inside `pnpm test:all`. A loader argument has no
 * ordering to get wrong.
 */
describe('critical dependency wrappers', () => {
  it('returns undefined when beasties cannot be imported', async () => {
    const beasties = await getBeasties('/out', {}, () => {
      throw new Error('missing')
    })
    expect(beasties).toBeUndefined()
  })

  it('returns undefined when zig-critters exposes no extractor', async () => {
    expect(await getZigCritters(async () => ({}))).toBeUndefined()
  })

  it('returns undefined when zig-critters cannot be imported', async () => {
    const zig = await getZigCritters(async () => {
      throw new Error('missing')
    })
    expect(zig).toBeUndefined()
  })
})
