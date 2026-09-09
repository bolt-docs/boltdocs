import { describe, it, expect } from 'vitest'
import { sortRoutes } from '../../src/node/routes/sorter'
import type { RouteMeta } from '../../src/node/routes/types'

describe('sortRoutes', () => {
  it('should sort by sidebarPosition when explicitly provided', () => {
    const r1: RouteMeta = { path: '/docs/a', title: 'A', sidebarPosition: 10 }
    const r2: RouteMeta = { path: '/docs/b', title: 'B', sidebarPosition: 5 }
    const r3: RouteMeta = { path: '/docs/c', title: 'C', sidebarPosition: 15 }

    const routes = [r1, r2, r3]
    const sorted = sortRoutes(routes)

    expect(sorted[0].title).toBe('B') // 5
    expect(sorted[1].title).toBe('A') // 10
    expect(sorted[2].title).toBe('C') // 15
  })

  it('should sort ungrouped before grouped', () => {
    const r1: RouteMeta = { path: '/a', title: 'A', group: 'group1' }
    const r2: RouteMeta = { path: '/b', title: 'B' } // ungrouped

    const sorted = sortRoutes([r1, r2])
    expect(sorted[0].title).toBe('B')
    expect(sorted[1].title).toBe('A')
  })

  it('should sort by title alphabetically when no position is inferrable', () => {
    const r1: RouteMeta = { path: '/docs/apple', title: 'Apple' }
    const r2: RouteMeta = { path: '/docs/banana', title: 'Banana' }
    const r3: RouteMeta = { path: '/docs/aardvark', title: 'Aardvark' }

    const routes = [r1, r2, r3]
    const sorted = sortRoutes(routes)

    expect(sorted[0].title).toBe('Aardvark')
    expect(sorted[1].title).toBe('Apple')
    expect(sorted[2].title).toBe('Banana')
  })

  it('should sort groups by groupPosition', () => {
    const r1: RouteMeta = {
      path: '/b',
      title: 'B',
      group: 'group2',
      groupPosition: 2,
    }
    const r2: RouteMeta = {
      path: '/a',
      title: 'A',
      group: 'group1',
      groupPosition: 1,
    }

    const routes = [r1, r2]
    const sorted = sortRoutes(routes)

    expect(sorted[0].title).toBe('A') // group position 1 comes first
    expect(sorted[1].title).toBe('B')
  })

  it('should sort groups by groupTitle fallback to group alphabetically', () => {
    const r1: RouteMeta = {
      path: '/b',
      title: 'B',
      group: 'group2',
      groupTitle: 'Zebra',
    }
    const r2: RouteMeta = {
      path: '/a',
      title: 'A',
      group: 'group1',
      groupTitle: 'Apple',
    }

    const routes = [r1, r2]
    const sorted = sortRoutes(routes)

    expect(sorted[0].title).toBe('A') // Apple comes before Zebra
    expect(sorted[1].title).toBe('B')
  })

  it('should handle missing property fallbacks in compare functions', () => {
    const r1: RouteMeta = {
      path: '/a',
      title: 'A',
      group: 'g',
      groupPosition: 1,
    }
    const r2: RouteMeta = { path: '/b', title: 'B', group: 'h' } // missing groupPosition

    // R1 has position, R2 does not. R1 wins.
    const sortedGroups = sortRoutes([r2, r1])
    expect(sortedGroups[0].title).toBe('A')

    const r3: RouteMeta = { path: '/c', title: 'C', sidebarPosition: 1 }
    const r4: RouteMeta = { path: '/d', title: 'D' } // missing sidebarPosition

    // R3 has position, R4 does not. R3 wins.
    const sortedItems = sortRoutes([r4, r3])
    expect(sortedItems[0].title).toBe('C')
  })

  it('should sort items within the same group by item position then title', () => {
    // Both are in 'group1'. One has position 10, other has position 5
    const r1: RouteMeta = {
      path: '/a',
      title: 'A',
      group: 'group1',
      sidebarPosition: 10,
    }
    const r2: RouteMeta = {
      path: '/b',
      title: 'B',
      group: 'group1',
      sidebarPosition: 5,
    }

    // R3 and R4 have same position; title remains the first tie-breaker.
    const r3: RouteMeta = {
      path: '/c',
      title: 'Z',
      group: 'group1',
      sidebarPosition: 15,
    }
    const r4: RouteMeta = {
      path: '/d',
      title: 'C',
      group: 'group1',
      sidebarPosition: 15,
    }

    const routes = [r1, r2, r3, r4]
    const sorted = sortRoutes(routes)

    expect(sorted[0].title).toBe('B') // pos 5
    expect(sorted[1].title).toBe('A') // pos 10
    expect(sorted[2].title).toBe('C') // pos 15, title C
    expect(sorted[3].title).toBe('Z') // pos 15, title Z
  })

  it('uses the path as a deterministic tie-breaker after title', () => {
    const routes: RouteMeta[] = [
      { path: '/docs/z', title: 'Same', sidebarPosition: 1 },
      { path: '/docs/a', title: 'Same', sidebarPosition: 1 },
    ]

    expect(sortRoutes(routes).map((route) => route.path)).toEqual([
      '/docs/a',
      '/docs/z',
    ])
  })

  it('should sort ungrouped with high position after grouped folders', () => {
    const r1: RouteMeta = {
      path: '/a',
      title: 'A',
      group: 'group1',
      groupPosition: 1,
    }
    const r2: RouteMeta = { path: '/b', title: 'B', sidebarPosition: 20 } // ungrouped, position 20
    const r3: RouteMeta = {
      path: '/c',
      title: 'C',
      group: 'group2',
      groupPosition: 2,
    }

    const sorted = sortRoutes([r2, r1, r3])
    expect(sorted[0].group).toBe('group1')
    expect(sorted[1].group).toBe('group2')
    expect(sorted[2].title).toBe('B')
  })
})
