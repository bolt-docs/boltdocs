import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  generateRoutes,
  invalidateRouteCache,
} from '../../src/node/routes/index'
import * as parser from '../../src/node/routes/parser'
import { getRouteCacheContext } from '../../src/node/routes/cache'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/**
 * Regression test for the "Failed to compute frontmatter delta:
 * Symbol(route-generation-invalidated)" error spam in the dev server.
 *
 * When a route generation is invalidated mid-flight (e.g. a burst of file
 * edits while HMR regenerates the route map), generateRoutes must retry
 * internally and never let the internal sentinel symbol escape to callers
 * such as computeFrontmatterDelta.
 */
describe('generateRoutes concurrent invalidation retry', () => {
  let tempRoot: string | undefined
  let spy: ReturnType<typeof vi.spyOn> | undefined

  afterEach(() => {
    spy?.mockRestore()
    spy = undefined
    vi.restoreAllMocks()
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true })
    tempRoot = undefined
  })

  it('completes instead of leaking the invalidated symbol when invalidated mid-flight', async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-retry-'))
    const docsDir = path.join(tempRoot, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })
    fs.writeFileSync(path.join(docsDir, 'a.md'), '# A')
    fs.writeFileSync(path.join(docsDir, 'b.md'), '# B')

    const context = getRouteCacheContext(docsDir)

    // Simulate a concurrent invalidation arriving while the FIRST generation
    // is parsing files (exactly what happens when HMR invalidates the route
    // cache while a delta generation is in flight). The retry pass must not
    // trigger the parser again with the spy's invalidation side effect.
    let parseCount = 0
    spy = vi
      .spyOn(parser, 'parseDocFile')
      .mockImplementation(async (file: string) => {
        parseCount++
        if (parseCount === 1) {
          invalidateRouteCache(context)
        }
        return {
          route: {
            path: '/docs/' + path.basename(file, path.extname(file)),
            title: 'T',
          },
          relativeDir: undefined,
        } as never
      })

    // Must resolve normally — the internal retry absorbs the invalidation.
    const routes = await generateRoutes(docsDir, undefined, '/docs')

    expect(routes).toHaveLength(2)
    expect(routes.map((r) => r.path).sort()).toEqual(['/docs/a', '/docs/b'])
    // First pass was invalidated, the retry pass parsed the files again.
    expect(parseCount).toBeGreaterThanOrEqual(3)
  })
})
