import { describe, expect, it } from 'vitest'

function isPageCacheValid(
  cachedHash: string,
  sourceFile: string | undefined,
  fallbackHash: string,
  currentMtimeSize: string | undefined,
): boolean {
  const currentHash = sourceFile ? currentMtimeSize : fallbackHash
  return currentHash === cachedHash
}

describe('page cache identity', () => {
  it('uses the post-build fallback for synthetic routes without source files', () => {
    const initialProbeHash = 'stat-only-probe'
    const effectiveBuildHash = 'satteri-manifest-hash'

    expect(
      isPageCacheValid(
        effectiveBuildHash,
        undefined,
        effectiveBuildHash,
        undefined,
      ),
    ).toBe(true)
    expect(
      isPageCacheValid(
        effectiveBuildHash,
        undefined,
        initialProbeHash,
        undefined,
      ),
    ).toBe(false)
  })

  it('continues to prefer source metadata for real document routes', () => {
    expect(
      isPageCacheValid(
        '1710000000000:128',
        'docs/index.md',
        'global-build-hash',
        '1710000000000:128',
      ),
    ).toBe(true)
    expect(
      isPageCacheValid(
        '1710000000000:128',
        'docs/index.md',
        'global-build-hash',
        '1710000000000:129',
      ),
    ).toBe(false)
  })
})
