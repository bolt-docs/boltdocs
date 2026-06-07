import { describe, it, expect } from 'vitest'
import { routesToPaths } from '../src/node/utils'
import type { RouteRecord } from '../src/types'

describe('ssg routesToPaths', () => {
  it('should resolve flat routes correctly', async () => {
    const routes: RouteRecord[] = [
      { path: '/' },
      { path: '/about' },
      { path: '/docs/getting-started' },
    ]
    const { paths } = await routesToPaths(routes)
    expect(paths).toContain('/')
    expect(paths).toContain('/about')
    expect(paths).toContain('/docs/getting-started')
  })

  it('should resolve nested child routes', async () => {
    const routes: RouteRecord[] = [
      {
        path: '/docs',
        children: [{ path: 'guide' }, { path: 'reference' }],
      },
    ]
    const { paths } = await routesToPaths(routes)
    expect(paths).toContain('/docs')
    expect(paths).toContain('/docs/guide')
    expect(paths).toContain('/docs/reference')
  })

  it('should handle path: "." as same path as parent', async () => {
    const routes: RouteRecord[] = [
      {
        path: '/docs',
        children: [{ path: '.' }],
      },
    ]
    const { paths } = await routesToPaths(routes)
    expect(paths).toContain('/docs')
    expect(paths.filter((p) => p === '/docs')).toHaveLength(1)
  })

  it('should resolve nested index routes using the parent path as prefix', async () => {
    const routes: RouteRecord[] = [
      {
        path: '/docs/v2',
        children: [{ index: true }],
      },
    ]
    const { paths } = await routesToPaths(routes)
    // Previously this would have added '/' instead of '/docs/v2'
    expect(paths).toContain('/docs/v2')
    expect(paths).not.toContain('/')
  })

  it('should handle pathless layout routes with index children correctly', async () => {
    const routes: RouteRecord[] = [
      {
        children: [{ index: true }],
      },
    ]
    const { paths } = await routesToPaths(routes)
    expect(paths).toContain('/')
  })
})
