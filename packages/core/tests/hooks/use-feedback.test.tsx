import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFeedback } from '../../src/client/hooks/use-feedback'
import { useRoutes } from '../../src/client/hooks/use-routes'

// Setup mock route state that we can mutate during test cases
let currentRouteMock = {
  path: '/docs/getting-started',
  title: 'Getting Started',
}

vi.mock('../../src/client/app/config-context', () => ({
  useConfig: vi.fn(() => ({
    integrations: {
      feedback: {
        custom: {
          enabled: true,
          endpoint: '/api/feedback-custom-endpoint',
        },
      },
    },
  })),
}))

vi.mock('../../src/client/hooks/use-routes', () => ({
  useRoutes: vi.fn(() => ({
    currentRoute: currentRouteMock,
  })),
}))

describe('useFeedback Hook', () => {
  beforeEach(() => {
    currentRouteMock = {
      path: '/docs/getting-started',
      title: 'Getting Started',
    }
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('should initialize with default states', () => {
    const { result } = renderHook(() => useFeedback())

    expect(result.current.rating).toBeNull()
    expect(result.current.comment).toBe('')
    expect(result.current.loading).toBe(false)
    expect(result.current.submitted).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should update rating and comment correctly', () => {
    const { result } = renderHook(() => useFeedback())

    act(() => {
      result.current.setRating('good')
      result.current.setComment('Nice work!')
    })

    expect(result.current.rating).toBe('good')
    expect(result.current.comment).toBe('Nice work!')
  })

  it('should submit through custom onSubmit callback if provided', async () => {
    const onSubmitSpy = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useFeedback({ onSubmit: onSubmitSpy }))

    act(() => {
      result.current.setRating('good')
      result.current.setComment('Super clean layout!')
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(onSubmitSpy).toHaveBeenCalledWith({
      rating: 'good',
      comment: 'Super clean layout!',
      path: '/docs/getting-started',
      title: 'Getting Started',
    })
    expect(result.current.submitted).toBe(true)
    expect(result.current.loading).toBe(false)
  })

  it('should submit via fetch to default/config endpoint when onSubmit is not provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useFeedback())

    act(() => {
      result.current.setRating('bad')
      result.current.setComment('Hard to read.')
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/feedback-custom-endpoint',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 'bad',
          comment: 'Hard to read.',
          path: '/docs/getting-started',
          title: 'Getting Started',
        }),
      }),
    )
    expect(result.current.submitted).toBe(true)
    expect(result.current.loading).toBe(false)
  })

  it('should handle fetch errors gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      }),
    )

    const { result } = renderHook(() => useFeedback())

    act(() => {
      result.current.setRating('neutral')
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(result.current.submitted).toBe(false)
    expect(result.current.error).toBe('Internal Server Error')
  })

  it('should reset feedback state when path changes', () => {
    const { result, rerender } = renderHook(() => useFeedback())

    act(() => {
      result.current.setRating('good')
      result.current.setComment('Looks great!')
    })
    expect(result.current.rating).toBe('good')

    // Change path to trigger hook's reset useEffect inside act() to flush state updates
    act(() => {
      currentRouteMock = {
        path: '/docs/next-page',
        title: 'Next Page',
      }

      vi.mocked(useRoutes).mockReturnValue({
        currentRoute: currentRouteMock,
      } as any)

      rerender()
    })

    expect(result.current.rating).toBeNull()
    expect(result.current.comment).toBe('')
    expect(result.current.submitted).toBe(false)
  })
})
