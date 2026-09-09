/// <reference types="vitest" />
/// <reference types="vitest/globals" />

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  usePosts,
  usePost,
  useRecentPosts,
} from '../../src/client/collections/hooks'
import { useCollectionsData } from '../../src/client/collections/collections-context'
import { useRoutes } from '../../src/client/hooks/use-routes'
import { useConfig } from '../../src/client/app/config-context'

vi.mock('../../src/client/collections/collections-context')
vi.mock('../../src/client/hooks/use-routes')
vi.mock('../../src/client/app/config-context')

const mockCollectionData = {
  blog: [
    {
      path: '/blog/en/first-post',
      title: 'First Post EN',
      locale: 'en',
      filePath: 'docs/blog/first-post.md',
    },
    {
      path: '/blog/es/first-post',
      title: 'First Post ES',
      locale: 'es',
      filePath: 'docs/blog/first-post.md',
      date: '2025-01-01',
    },
    {
      path: '/blog/es/second-post',
      title: 'Second Post ES',
      locale: 'es',
      filePath: 'docs/blog/second-post.md',
      date: '2025-02-01',
    },
  ],
}

describe('collection hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useCollectionsData as any).mockReturnValue(mockCollectionData)
    ;(useConfig as any).mockReturnValue({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'EN', es: 'ES' },
      },
      versions: {
        defaultVersion: 'v1',
        versions: [{ path: 'v1', label: 'v1' }],
      },
    })
  })

  it('should return only posts for the active locale', () => {
    ;(useRoutes as any).mockReturnValue({
      currentLocale: 'es',
      currentVersion: undefined,
    })

    const { result } = renderHook(() => usePosts('blog'))

    expect(result.current).toHaveLength(2)
    expect(result.current[0].locale).toBe('es')
    expect(result.current[0].title).toBe('Second Post ES')
    expect(result.current[1].locale).toBe('es')
  })

  it('should return recent posts only for the active locale', () => {
    ;(useRoutes as any).mockReturnValue({
      currentLocale: 'es',
      currentVersion: undefined,
    })

    const { result } = renderHook(() => useRecentPosts('blog', 1))

    expect(result.current).toHaveLength(1)
    expect(result.current[0].locale).toBe('es')
    expect(result.current[0].title).toBe('Second Post ES')
  })

  it('should return a translated post by slug', () => {
    ;(useRoutes as any).mockReturnValue({
      currentLocale: 'es',
      currentVersion: undefined,
    })

    const { result } = renderHook(() => usePost('blog', 'first-post'))

    expect(result.current).toBeDefined()
    expect(result.current?.title).toBe('First Post ES')
  })

  it('should fall back to default locale when post locale is unset', () => {
    const fallbackData = {
      blog: [
        {
          path: '/blog/first-post',
          title: 'First Post Default',
          filePath: 'docs/blog/first-post.md',
        },
      ],
    }
    ;(useCollectionsData as any).mockReturnValue(fallbackData)
    ;(useRoutes as any).mockReturnValue({
      currentLocale: 'en',
      currentVersion: undefined,
    })

    const { result } = renderHook(() => usePosts('blog'))

    expect(result.current).toHaveLength(1)
    expect(result.current[0].title).toBe('First Post Default')
  })
})
