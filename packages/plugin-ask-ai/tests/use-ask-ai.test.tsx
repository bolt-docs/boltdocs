// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useConfigMock = vi.hoisted(() => vi.fn())

vi.mock('boltdocs/client', () => ({
  useConfig: useConfigMock,
}))

const { useAskAi } = await import('../src/client/use-ask-ai')

function sseResponse(events: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${event}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  )
}

beforeEach(() => {
  useConfigMock.mockReturnValue({
    plugins: [
      {
        name: 'boltdocs-plugin-ask-ai',
        metadata: {
          endpoint: '/configured-ask-ai',
          devMode: true,
          classNames: { panel: 'configured-panel' },
          title: 'Configured title',
        },
      },
    ],
  })
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useAskAi', () => {
  it('sends bounded page context to the configured endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([JSON.stringify({ text: 'Answer' })]),
    )
    const { result } = renderHook(() =>
      useAskAi({
        getContext: () => ({
          page: '/docs/serverless',
          content: 'Serverless context',
        }),
      }),
    )
    act(() => result.current.setIsOpen(true))

    await act(async () => {
      await result.current.submitQuestion('How does this work?')
    })

    const [endpoint, init] = vi.mocked(fetch).mock.calls[0]
    expect(endpoint).toBe('/configured-ask-ai')
    expect(JSON.parse(String(init?.body))).toEqual({
      question: 'How does this work?',
      currentPage: window.location.pathname,
      context: {
        page: '/docs/serverless',
        content: 'Serverless context',
      },
    })
    expect(result.current.classNames.panel).toBe('configured-panel')
    expect(result.current.ui.title).toBe('Configured title')
  })

  it('does not log or display raw server error details', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([
        JSON.stringify({
          error: 'AI_PROVIDER_ERROR apiKey=sk-never-display-this',
        }),
      ]),
    )
    const { result } = renderHook(() => useAskAi())
    act(() => result.current.setIsOpen(true))

    await act(async () => {
      await result.current.submitQuestion('Trigger safe error')
    })

    await waitFor(() => {
      expect(result.current.messages.at(-1)?.errorMessage).toBe(
        'The AI assistant could not complete this request.',
      )
    })
    expect(result.current.messages.at(-1)?.content).not.toContain('sk-never')
    expect(console.error).not.toHaveBeenCalled()
  })

  it('does not leak usage metadata into a later response', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        sseResponse([
          JSON.stringify({
            usage: {
              promptTokens: 10,
              completionTokens: 5,
              totalTokens: 15,
              model: 'gpt-4o-mini',
              provider: 'openai',
              elapsedMs: 1,
            },
          }),
          JSON.stringify({ text: 'First answer' }),
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([JSON.stringify({ text: 'Second answer' })]),
      )
    const { result } = renderHook(() => useAskAi())
    act(() => result.current.setIsOpen(true))

    await act(async () => {
      await result.current.submitQuestion('First')
    })
    await act(async () => {
      await result.current.submitQuestion('Second')
    })

    await waitFor(() => {
      expect(result.current.messages.at(-1)?.content).toBe('Second answer')
    })
    expect(
      result.current.messages.find(
        (message) => message.content === 'First answer',
      )?.usage?.totalTokens,
    ).toBe(15)
    expect(result.current.messages.at(-1)?.usage).toBeUndefined()
  })
})
