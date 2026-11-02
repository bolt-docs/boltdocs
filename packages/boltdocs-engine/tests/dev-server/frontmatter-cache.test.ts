import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/node/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/node/utils')>()
  return {
    ...actual,
    parseFrontmatterAsync: vi.fn(async () => ({
      data: { title: 'X', lastUpdated: '2020-01-01' },
    })),
  }
})

import {
  computeFrontmatterHash,
  getFrontmatterHash,
  setFrontmatterHash,
  removeFrontmatterHash,
} from '../../src/node/dev-server/frontmatter-cache'

describe('frontmatter-cache', () => {
  it('computes a stable hash that ignores lastUpdated', async () => {
    const h1 = await computeFrontmatterHash('x.mdx')
    const h2 = await computeFrontmatterHash('y.mdx')
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[a-f0-9]{32}$/)
  })

  it('sets, reads and removes hashes on the legacy map', () => {
    setFrontmatterHash('/a.mdx', 'abc')
    expect(getFrontmatterHash('/a.mdx')).toBe('abc')
    removeFrontmatterHash('/a.mdx')
    expect(getFrontmatterHash('/a.mdx')).toBeUndefined()
  })
})
