import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCopyButton } from '../../src/client/components/mdx/use-copy-button'
import { useExpandable } from '../../src/client/components/mdx/use-expandable'
import { useCodeBlockFeedback } from '../../src/client/components/mdx/use-code-block-feedback'
import { useCodeBlock } from '../../src/client/components/mdx/use-code-block'
import { useConfig } from '../../src/client/app/config-context'

vi.mock('../../src/client/app/config-context', () => ({
  useConfig: vi.fn(),
}))

const textContentStub = { textContent: 'a\nb\nc\nd\ne\nf\ng' } as any

describe('useCopyButton', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('flips copied state and resets it after 2 seconds', () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    const { result } = renderHook(() => useCopyButton())

    expect(result.current.copied).toBe(false)

    act(() => {
      result.current.handleCopy('hello')
    })
    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.copied).toBe(false)
  })
})

describe('useExpandable', () => {
  it('stays non-expandable without a measured pre element', () => {
    const { result } = renderHook(() => useExpandable({ children: 'x' }))
    expect(result.current.isExpandable).toBe(false)
    expect(result.current.shouldTruncate).toBe(false)
  })

  it('detects overflow from the measured pre text and toggles', () => {
    const { result, rerender } = renderHook(
      ({ content }: { content: string }) =>
        useExpandable({ children: content }),
      { initialProps: { content: 'x' } },
    )

    result.current.preRef.current = textContentStub
    rerender({ content: 'a\nb\nc\nd\ne\nf\ng' })

    expect(result.current.isExpandable).toBe(true)
    expect(result.current.shouldTruncate).toBe(true)

    act(() => {
      result.current.toggle()
    })
    expect(result.current.isExpanded).toBe(true)
    expect(result.current.shouldTruncate).toBe(false)

    act(() => {
      result.current.toggle()
    })
    expect(result.current.isExpanded).toBe(false)
    expect(result.current.shouldTruncate).toBe(true)
  })

  it('respects a custom maxLines', () => {
    const { result, rerender } = renderHook(
      ({ content }: { content: string }) =>
        useExpandable({ children: content, maxLines: 8 }),
      { initialProps: { content: 'x' } },
    )

    result.current.preRef.current = textContentStub
    rerender({ content: 'a\nb\nc\nd\ne\nf\ng' })

    expect(result.current.isExpandable).toBe(false)
  })

  it('uses real rendered overflow instead of raw line count alone', () => {
    const { result, rerender } = renderHook(
      ({ content }: { content: string }) =>
        useExpandable({ children: content, maxLines: 12 }),
      { initialProps: { content: 'x' } },
    )

    result.current.preRef.current = {
      textContent: 'short\ncode\nblock',
      scrollHeight: 420,
      clientHeight: 350,
    } as any

    rerender({ content: 'short\ncode\nblock' })

    expect(result.current.isExpandable).toBe(true)
    expect(result.current.shouldTruncate).toBe(true)
  })
})

describe('useCodeBlockFeedback', () => {
  it('is disabled when no feedback integration is configured', () => {
    vi.mocked(useConfig).mockReturnValue({} as any)
    const { result } = renderHook(() => useCodeBlockFeedback())
    expect(result.current.enabled).toBe(false)
    expect(result.current.rated).toBeNull()
  })

  it('is disabled for plain blocks even when configured', () => {
    vi.mocked(useConfig).mockReturnValue({
      integrations: {
        feedback: { custom: { enabled: true, endpoint: '/api/feedback' } },
      },
    } as any)
    const { result } = renderHook(() =>
      useCodeBlockFeedback({ plain: true, lang: 'ts' }),
    )
    expect(result.current.enabled).toBe(false)
  })

  it('submits through the custom handler and locks the rating', async () => {
    vi.mocked(useConfig).mockReturnValue({
      integrations: {
        feedback: { custom: { enabled: true, endpoint: '/api/feedback' } },
      },
    } as any)
    const submit = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useCodeBlockFeedback({ lang: 'ts', submitFeedback: submit }),
    )

    expect(result.current.enabled).toBe(true)

    await act(async () => {
      await result.current.handleRate('up', 'const x = 1')
    })

    expect(result.current.rated).toBe('up')
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit.mock.calls[0][0]).toMatchObject({
      rating: 'good',
      lang: 'ts',
      snippet: 'const x = 1',
    })

    await act(async () => {
      await result.current.handleRate('down')
    })
    expect(submit).toHaveBeenCalledTimes(1)
  })
})

describe('useCodeBlock (deprecated composition)', () => {
  it('keeps the historical return shape', () => {
    vi.mocked(useConfig).mockReturnValue({
      integrations: {
        feedback: { custom: { enabled: true, endpoint: '/api/feedback' } },
      },
    } as any)

    const { result } = renderHook(() =>
      useCodeBlock({
        children: 'const x = 1',
        lang: 'ts',
        'data-highlighted': 'true',
      } as any),
    )

    expect(result.current.lang).toBe('ts')
    expect(result.current.isHighlighted).toBe(true)
    expect(result.current.copied).toBe(false)
    expect(result.current.rated).toBeNull()
    expect(result.current.showCodeBlockFeedback).toBe(true)
    expect(result.current.isExpandable).toBe(false)
    expect(result.current.shouldTruncate).toBe(false)
    expect(result.current.isExpanded).toBe(false)
    expect(result.current.preRef.current).toBeNull()
    expect(typeof result.current.handleCopy).toBe('function')
    expect(typeof result.current.handleRate).toBe('function')
    expect(typeof result.current.setIsExpanded).toBe('function')
    expect(result.current.effectiveHighlightedHtml).toBeUndefined()
    expect(result.current.effectiveTitle).toBeUndefined()
  })
})
