import { describe, expect, it } from 'vitest'
import { toClientRouteData } from '../../src/node/plugin/virtual-modules'
import type { RouteMeta } from '../../src/node/routes/types'

describe('toClientRouteData', () => {
  it('keeps contributors in the serialized client route payload', () => {
    const route = {
      path: '/docs/guide',
      componentPath: '/repo/docs/guide.md',
      filePath: 'guide.md',
      title: 'Guide',
      lastUpdated: '2026-02-01T10:00:00.000Z',
      contributors: [
        {
          name: 'Alice',
          commits: 3,
          lastCommit: '2026-02-01T10:00:00.000Z',
        },
      ],
    } as RouteMeta

    const clientRoute = toClientRouteData(route)
    expect(clientRoute.lastUpdated).toBe('2026-02-01T10:00:00.000Z')
    expect(clientRoute.contributors).toEqual(route.contributors)
    expect(JSON.parse(JSON.stringify(clientRoute)).contributors).toEqual(
      route.contributors,
    )
  })
})
