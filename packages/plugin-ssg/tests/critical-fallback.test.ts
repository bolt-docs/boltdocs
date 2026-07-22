import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit tests for critical CSS engine selection:
 * - turbo + zig-critters available → zig only
 * - turbo + zig-critters missing → beasties fallback
 * - non-turbo → beasties
 * - beastiesOptions === false → neither
 *
 * Mirrors the selection logic in src/node/build.ts without a full SSG build.
 */

vi.mock('../src/node/critical', () => ({
  getBeasties: vi.fn(),
  getZigCritters: vi.fn(),
}))

import { getBeasties, getZigCritters } from '../src/node/critical'

async function selectEngines(options: {
  turbo: boolean
  beastiesOptions: object | false
}) {
  const { turbo, beastiesOptions } = options

  const zigCritters = turbo ? await getZigCritters() : undefined

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses zig-critters only when turbo and WASM are available', async () => {
    const zig = { processHtml: vi.fn() }
    vi.mocked(getZigCritters).mockResolvedValue(zig)
    vi.mocked(getBeasties).mockResolvedValue({ process: vi.fn() } as never)

    const { zigCritters, beasties } = await selectEngines({
      turbo: true,
      beastiesOptions: {},
    })

    expect(zigCritters).toBe(zig)
    expect(beasties).toBeUndefined()
    expect(getBeasties).not.toHaveBeenCalled()
  })

  it('falls back to beasties when turbo is on but zig-critters is unavailable', async () => {
    const beastiesInstance = { process: vi.fn() }
    vi.mocked(getZigCritters).mockResolvedValue(undefined)
    vi.mocked(getBeasties).mockResolvedValue(beastiesInstance as never)

    const { zigCritters, beasties } = await selectEngines({
      turbo: true,
      beastiesOptions: {},
    })

    expect(zigCritters).toBeUndefined()
    expect(beasties).toBe(beastiesInstance)
    expect(getBeasties).toHaveBeenCalledOnce()
  })

  it('uses beasties when turbo is off', async () => {
    const beastiesInstance = { process: vi.fn() }
    vi.mocked(getBeasties).mockResolvedValue(beastiesInstance as never)

    const { zigCritters, beasties } = await selectEngines({
      turbo: false,
      beastiesOptions: {},
    })

    expect(zigCritters).toBeUndefined()
    expect(beasties).toBe(beastiesInstance)
    expect(getZigCritters).not.toHaveBeenCalled()
  })

  it('skips both engines when beastiesOptions is false', async () => {
    vi.mocked(getZigCritters).mockResolvedValue(undefined)

    const { zigCritters, beasties } = await selectEngines({
      turbo: true,
      beastiesOptions: false,
    })

    expect(zigCritters).toBeUndefined()
    expect(beasties).toBeUndefined()
    expect(getBeasties).not.toHaveBeenCalled()
  })
})
