import { describe, it, expect, vi } from 'vitest'

/**
 * Unit tests for critical CSS engine selection:
 * - zig-critters available → zig only (pool when possible, serial otherwise)
 * - zig-critters missing → beasties fallback
 * - beastiesOptions === false → neither
 *
 * Mirrors the selection logic in src/node/build.ts without a full SSG build.
 */

vi.mock('../src/node/critical', () => ({
  getBeasties: vi.fn(),
  getZigCritters: vi.fn(),
  createZigCrittersEngine: vi.fn(),
}))

import {
  getBeasties,
  getZigCritters,
  createZigCrittersEngine,
} from '../src/node/critical'

async function selectEngines(options: {
  turbo: boolean
  beastiesOptions: object | false
}) {
  const { beastiesOptions } = options

  // build.ts: pool-first engine creation, no beasties fallback.
  const zigCritters = await createZigCrittersEngine({ concurrency: 4 })

  const beasties =
    beastiesOptions !== false && !zigCritters
      ? await getBeasties('out', {
          publicPath: '/',
          ...(typeof beastiesOptions === 'object' ? beastiesOptions : {}),
        })
      : undefined

  return { zigCritters, beasties }
}

describe('critical CSS engine selection', () => {
  it('uses zig-critters only when the engine factory succeeds', async () => {
    const zig = { extractCriticalCss: vi.fn() }
    vi.mocked(createZigCrittersEngine).mockResolvedValue(zig)
    vi.mocked(getBeasties).mockResolvedValue({ process: vi.fn() } as never)

    const { zigCritters, beasties } = await selectEngines({
      turbo: true,
      beastiesOptions: {},
    })

    expect(zigCritters).toBe(zig)
    expect(beasties).toBeUndefined()
    expect(getBeasties).not.toHaveBeenCalled()
  })

  it('falls back to beasties when zig-critters is unavailable', async () => {
    const beastiesInstance = { process: vi.fn() }
    vi.mocked(createZigCrittersEngine).mockResolvedValue(undefined)
    vi.mocked(getBeasties).mockResolvedValue(beastiesInstance as never)

    const { zigCritters, beasties } = await selectEngines({
      turbo: true,
      beastiesOptions: {},
    })

    expect(zigCritters).toBeUndefined()
    expect(beasties).toBe(beastiesInstance)
    expect(getBeasties).toHaveBeenCalledOnce()
  })

  it('passes pool concurrency to the engine factory', async () => {
    vi.mocked(createZigCrittersEngine).mockResolvedValue({
      extractCriticalCss: vi.fn(),
    })
    await selectEngines({ turbo: false, beastiesOptions: false })
    expect(createZigCrittersEngine).toHaveBeenCalledWith({ concurrency: 4 })
    expect(getZigCritters).not.toHaveBeenCalled()
  })

  it('skips both engines when beastiesOptions is false and engine missing', async () => {
    vi.mocked(createZigCrittersEngine).mockResolvedValue(undefined)
    vi.mocked(getBeasties).mockResolvedValue(undefined as never)

    const { zigCritters, beasties } = await selectEngines({
      turbo: false,
      beastiesOptions: false,
    })

    expect(zigCritters).toBeUndefined()
    expect(beasties).toBeUndefined()
  })
})
