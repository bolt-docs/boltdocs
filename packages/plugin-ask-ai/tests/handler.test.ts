import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { streamLLMResponse } from '../src/server/handler'
import type { StreamLLMResponseOptions } from '../src/server/handler'

function createMockFetchWithChunks(chunks: string[]) {
  const encoder = new TextEncoder()
  let chunkIndex = 0

  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    body: new ReadableStream({
      start(controller) {
        const interval = setInterval(() => {
          if (chunkIndex < chunks.length) {
            controller.enqueue(encoder.encode(chunks[chunkIndex]))
            chunkIndex++
          } else {
            clearInterval(interval)
            controller.close()
          }
        }, 5)
      },
    }),
  })
}

function createBaseOptions(
  overrides: Partial<StreamLLMResponseOptions> = {},
): StreamLLMResponseOptions {
  return {
    provider: 'openai',
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful assistant.',
    question: 'What is Boltdocs?',
    context: [
      'Title: Getting Started\nPath: /docs/getting-started\nContent: Boltdocs is a documentation framework.',
    ],
    env: { OPENAI_API_KEY: 'test-key' },
    ...overrides,
  }
}

describe('streamLLMResponse', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('calls OpenAI API with correct parameters', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    global.fetch = createMockFetchWithChunks(chunks)

    const receivedChunks: string[] = []
    await streamLLMResponse(createBaseOptions(), (text) => {
      receivedChunks.push(text)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, opts] = (global.fetch as any).mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(opts.method).toBe('POST')
    expect(opts.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    })

    const body = JSON.parse(opts.body)
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.messages[0]).toEqual({
      role: 'system',
      content: 'You are a helpful assistant.',
    })
    expect(body.messages[1].role).toBe('user')
    expect(body.messages[1].content).toContain('Boltdocs')
    expect(body.stream).toBe(true)

    expect(receivedChunks.join('')).toBe('Hello world')
  })

  it('calls Anthropic API with correct parameters', async () => {
    const chunks = [
      'data: {"delta":{"text":"Hi"}}\n\n',
      'data: {"delta":{"text":" there"}}\n\n',
      'data: [DONE]\n\n',
    ]
    global.fetch = createMockFetchWithChunks(chunks)

    const receivedChunks: string[] = []
    await streamLLMResponse(
      createBaseOptions({
        provider: 'anthropic',
        env: { ANTHROPIC_API_KEY: 'test-anthropic-key' },
      }),
      (text) => {
        receivedChunks.push(text)
      },
    )

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, opts] = (global.fetch as any).mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(opts.headers).toEqual({
      'x-api-key': 'test-anthropic-key',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    })

    expect(receivedChunks.join('')).toBe('Hi there')
  })

  it('supports custom base URL (Ollama via custom provider)', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Response from Ollama"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    global.fetch = createMockFetchWithChunks(chunks)

    const receivedChunks: string[] = []
    await streamLLMResponse(
      createBaseOptions({
        provider: 'custom',
        env: {
          OPENAI_BASE_URL: 'http://localhost:11434/v1',
        },
      }),
      (text) => {
        receivedChunks.push(text)
      },
    )

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url] = (global.fetch as any).mock.calls[0]
    expect(url).toBe('http://localhost:11434/v1/chat/completions')

    expect(receivedChunks.join('')).toBe('Response from Ollama')
  })

  it('returns error message when OPENAI_API_KEY is missing', async () => {
    global.fetch = vi.fn()

    const receivedChunks: string[] = []
    await streamLLMResponse(
      createBaseOptions({
        env: {},
      }),
      (text) => {
        receivedChunks.push(text)
      },
    )

    expect(receivedChunks.join('')).toContain('OPENAI_API_KEY')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns error message when ANTHROPIC_API_KEY is missing', async () => {
    global.fetch = vi.fn()

    const receivedChunks: string[] = []
    await streamLLMResponse(
      createBaseOptions({
        provider: 'anthropic',
        env: {},
      }),
      (text) => {
        receivedChunks.push(text)
      },
    )

    expect(receivedChunks.join('')).toContain('ANTHROPIC_API_KEY')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('throws for unsupported provider', async () => {
    global.fetch = vi.fn()

    await expect(
      streamLLMResponse(
        createBaseOptions({ provider: 'unsupported' as any }),
        () => {},
      ),
    ).rejects.toThrow('Unsupported AI provider')
  })

  it('handles API errors gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Invalid API key'),
    })

    await expect(
      streamLLMResponse(createBaseOptions(), () => {}),
    ).rejects.toThrow('401')
  })

  it('handles stream abort via signal', async () => {
    const controller = new AbortController()

    const encoder = new TextEncoder()
    let resolveRead: any
    const readPromise = new Promise<{ value: Uint8Array; done: boolean }>(
      (resolve) => {
        resolveRead = resolve
      },
    )

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: {
        getReader: () => ({
          read: () => readPromise,
          cancel: vi.fn(),
        }),
      },
    })

    const receivedChunks: string[] = []
    const promise = streamLLMResponse(
      createBaseOptions({ signal: controller.signal }),
      (text) => {
        receivedChunks.push(text)
      },
    )

    controller.abort()
    resolveRead({ value: new Uint8Array(0), done: true })

    await promise
    expect(receivedChunks).toHaveLength(0)
  })

  it('batches chunks for efficiency', async () => {
    const chunks: string[] = []
    for (let i = 0; i < 10; i++) {
      chunks.push(`data: {"choices":[{"delta":{"content":"chunk${i}"}}]}\n\n`)
    }
    chunks.push('data: [DONE]\n\n')

    global.fetch = createMockFetchWithChunks(chunks)

    const receivedChunks: string[] = []
    await streamLLMResponse(createBaseOptions(), (text) => {
      receivedChunks.push(text)
    })

    expect(receivedChunks.length).toBeLessThanOrEqual(10)
    expect(receivedChunks.join('')).toBe(
      'chunk0chunk1chunk2chunk3chunk4chunk5chunk6chunk7chunk8chunk9',
    )
  })

  it('formats context correctly in prompt', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
    ]
    global.fetch = createMockFetchWithChunks(chunks)

    await streamLLMResponse(createBaseOptions(), () => {})

    const [, opts] = (global.fetch as any).mock.calls[0]
    const body = JSON.parse(opts.body)
    const userMessage = body.messages[1].content

    expect(userMessage).toContain('Documentation Context:')
    expect(userMessage).toContain('[Doc 1]:')
    expect(userMessage).toContain('User Question: What is Boltdocs?')
  })

  it('handles empty context', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
    ]
    global.fetch = createMockFetchWithChunks(chunks)

    await streamLLMResponse(createBaseOptions({ context: [] }), () => {})

    const [, opts] = (global.fetch as any).mock.calls[0]
    const body = JSON.parse(opts.body)
    const userMessage = body.messages[1].content

    expect(userMessage).toContain('No direct documentation context')
  })
})
