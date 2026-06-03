import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSidebar } from '../../src/client/hooks/use-sidebar'
import { useConfig } from '../../src/client/app/config-context'

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/docs/guides/intro' }),
}))

vi.mock('../../src/client/app/config-context')

describe('useSidebar', () => {
  it('should return groups containing path and filePath properties', () => {
    ;(useConfig as any).mockReturnValue({
      directoryMeta: {},
    })

    const routes = [
      {
        path: '/docs/guides',
        filePath: 'guides/index.md',
        title: 'Guides Index',
        slugParts: ['guides'],
      },
      {
        path: '/docs/guides/intro',
        filePath: 'guides/intro.md',
        title: 'Introduction',
        slugParts: ['guides'],
      },
    ]

    const { result } = renderHook(() => useSidebar(routes as any))
    const { groups } = result.current

    expect(groups).toHaveLength(1)
    expect(groups[0].title).toBe('Guides Index')
    expect(groups[0].path).toBe('/docs/guides')
    expect(groups[0].filePath).toBe('guides/index.md')
    expect(groups[0].routes).toHaveLength(1)
    expect(groups[0].routes[0].path).toBe('/docs/guides/intro')
  })
})
