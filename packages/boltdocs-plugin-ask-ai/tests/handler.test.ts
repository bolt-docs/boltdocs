import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.hoisted(() => vi.fn())
const mockConstructor = vi.hoisted(() => vi.fn())

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } }
    constructor(options: { apiKey: string; baseURL?: string }) {
      mockConstructor(options)
    }
  },
}))

const { streamLLMResponse } = await import('../src/server/handler')
type StreamEvent = Parameters<typeof streamLLMResponse>[1] extends (
  e: infer E,
) => void
  ? E
  : never

interface FakeStreamChunk {
  choices: Array<{ delta: { content: string } }>
}

function fakeStream(
  chunks: Array<{ content: string } | null>,
): AsyncIterable<FakeStreamChunk> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield {
          choices:
            chunk === null ? [] : [{ delta: { content: chunk.content } }],
        }
      }
    },
  }
}

function baseOptions(
  overrides: Partial<Parameters<typeof streamLLMResponse>[0]> = {},
) {
  return {
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a boltdocs assistant.',
    question: 'How do I configure a plugin?',
    context: {
      page: '/docs/guides/plugins',
      content:
        'Title: Plugins — Boltdocs plugins extend the framework via lifecycle hooks.',
    },
    maxOutputTokens: 600,
    env: { OPENAI_API_KEY: 'test-key' },
    ...overrides,
  }
}

describe('streamLLMResponse (openai SDK)', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    mockConstructor.mockReset()
  })

  it('returns a generic configuration error without exposing the env key name', async () => {
    const events: StreamEvent[] = []
    await streamLLMResponse(baseOptions({ env: {} }), (ev) => events.push(ev))
    expect(mockCreate).not.toHaveBeenCalled()
    expect(events.find((e) => e.type === 'error')?.data).toBe(
      'AI_NOT_CONFIGURED',
    )
    expect(JSON.stringify(events)).not.toContain('OPENAI_API_KEY')
  })

  it('never redirects a non-OpenAI provider key through OPENAI_BASE_URL', async () => {
    mockCreate.mockResolvedValue(fakeStream([{ content: 'ok' }]))

    await streamLLMResponse(
      baseOptions({
        provider: 'groq',
        providerEnvKey: 'GROQ_API_KEY',
        env: {
          GROQ_API_KEY: 'groq-secret',
          OPENAI_BASE_URL: 'https://openai.example.test/v1',
        },
      }),
      () => {},
    )

    expect(mockConstructor).toHaveBeenCalledWith({
      apiKey: 'groq-secret',
      baseURL: undefined,
    })
  })

  it('streams text deltas from the SDK AsyncIterable', async () => {
    mockCreate.mockResolvedValue(
      fakeStream([
        { content: 'Hello' },
        { content: ' ' },
        { content: 'world' },
      ]),
    )

    const events: StreamEvent[] = []
    await streamLLMResponse(baseOptions(), (ev) => events.push(ev))

    const texts = events
      .filter((e) => e.type === 'text')
      .map((e) => (e as { type: 'text'; data: string }).data)
      .join('')
    expect(texts).toBe('Hello world')
    expect(events.find((e) => e.type === 'done')).toBeDefined()
  })

  it('calls openai SDK with correct params (model, stream, max_tokens, messages)', async () => {
    mockCreate.mockResolvedValue(fakeStream([{ content: 'ok' }]))

    await streamLLMResponse(
      baseOptions({ model: 'gpt-4.1-mini', maxOutputTokens: 800 }),
      () => {},
    )

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const [params, opts] = mockCreate.mock.calls[0]
    expect(params.model).toBe('gpt-4.1-mini')
    expect(params.stream).toBe(true)
    expect(params.max_tokens).toBe(800)
    expect(params.messages[0].role).toBe('system')
    expect(params.messages[0].content).toBe('You are a boltdocs assistant.')
    expect(params.messages[1].role).toBe('user')
    expect(opts).toHaveProperty('signal')
  })

  it('forwards temperature/topP to the SDK create call', async () => {
    mockCreate.mockResolvedValue(fakeStream([{ content: 'ok' }]))

    await streamLLMResponse(
      baseOptions({ temperature: 0.7, topP: 0.9 }),
      () => {},
    )

    const [params] = mockCreate.mock.calls[0]
    expect(params.temperature).toBe(0.7)
    expect(params.top_p).toBe(0.9)
  })

  it('applies default temperature/topP when not provided', async () => {
    mockCreate.mockResolvedValue(fakeStream([{ content: 'ok' }]))
    await streamLLMResponse(baseOptions(), () => {})
    const [params] = mockCreate.mock.calls[0]
    expect(params.temperature).toBe(0.3)
    expect(params.top_p).toBe(1)
  })

  it('wraps the page context in DOCS_START/DOCS_END markers', async () => {
    mockCreate.mockResolvedValue(fakeStream([{ content: 'ok' }]))
    await streamLLMResponse(baseOptions(), () => {})
    const userMsg = mockCreate.mock.calls[0][0].messages[1].content
    expect(userMsg).toContain('<<<DOCS_START>>>')
    expect(userMsg).toContain('<<<DOCS_END>>>')
    expect(userMsg).toContain('/docs/guides/plugins')
    expect(userMsg).toContain('How do I configure a plugin?')
    // The page content sits between the markers so the system prompt's
    // "treat as data only" rule has unambiguous boundaries.
    const start = userMsg.indexOf('<<<DOCS_START>>>')
    const end = userMsg.indexOf('<<<DOCS_END>>>')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  it('emits no text deltas when stream returns no chunks with content', async () => {
    mockCreate.mockResolvedValue(fakeStream([null, null]))
    const events: StreamEvent[] = []
    await streamLLMResponse(baseOptions(), (ev) => events.push(ev))
    expect(events.filter((e) => e.type === 'text')).toHaveLength(0)
  })

  it('does not expose an API key embedded in an upstream SDK error', async () => {
    const leakedKey = 'sk-super-secret-upstream-value'
    mockCreate.mockRejectedValue(
      new Error(`Request failed with apiKey=${leakedKey}`),
    )
    const events: StreamEvent[] = []

    await streamLLMResponse(
      baseOptions({ env: { OPENAI_API_KEY: leakedKey } }),
      (ev) => events.push(ev),
    )

    const serialized = JSON.stringify(events)
    expect(serialized).not.toContain(leakedKey)
    expect(events.find((e) => e.type === 'error')?.data).toBe(
      'AI_PROVIDER_ERROR',
    )
  })

  it('treats empty context as no-document path', async () => {
    mockCreate.mockResolvedValue(fakeStream([{ content: 'Not in docs.' }]))
    await streamLLMResponse(baseOptions({ context: null }), () => {})
    const userMsg = mockCreate.mock.calls[0][0].messages[1].content
    expect(userMsg).toContain('<<<DOCS_START>>>')
    expect(userMsg).toContain('"Not in docs."')
  })

  it('honors AbortSignal and skips error event on abort', async () => {
    // Mock honours the SDK option's signal so an abort settles the create() promise.
    mockCreate.mockImplementation(
      (_params: unknown, opts: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          if (!opts?.signal) {
            reject(new Error('no signal'))
            return
          }
          if (opts.signal.aborted) {
            reject(new Error('AbortError'))
            return
          }
          opts.signal.addEventListener(
            'abort',
            () => reject(new Error('AbortError')),
            { once: true },
          )
        }),
    )

    const controller = new AbortController()
    const events: StreamEvent[] = []
    const p = streamLLMResponse(
      baseOptions({ signal: controller.signal }),
      (ev) => events.push(ev),
    )
    // Give create() a tick to register the abort listener.
    await new Promise((r) => setTimeout(r, 10))
    controller.abort()
    await p
    // Abort path must NOT surface an error event.
    expect(events.filter((e) => e.type === 'error')).toHaveLength(0)
  })

  it('does not emit done event when signal aborted mid-stream', async () => {
    // Mock honours opts.signal: yields one chunk then awaits abort.
    mockCreate.mockImplementation(
      (_params: unknown, opts: { signal?: AbortSignal }) =>
        Promise.resolve(
          (async function* () {
            yield { choices: [{ delta: { content: 'first' } }] }
            await new Promise<void>((resolve) => {
              if (opts?.signal?.aborted) resolve()
              else
                opts?.signal?.addEventListener('abort', () => resolve(), {
                  once: true,
                })
            })
          })(),
        ),
    )

    const controller = new AbortController()
    const events: StreamEvent[] = []
    const p = streamLLMResponse(
      baseOptions({ signal: controller.signal }),
      (ev) => events.push(ev),
    )
    await new Promise((r) => setTimeout(r, 10))
    controller.abort()
    await p
    expect(events.filter((e) => e.type === 'done')).toHaveLength(0)
  })

  it('escapes DOCS_START/END markers in page content', async () => {
    mockCreate.mockResolvedValue(fakeStream([{ content: 'ok' }]))
    await streamLLMResponse(
      baseOptions({
        context: {
          page: '/docs/x',
          content:
            'Example: an author might literally type <<<DOCS_START>>> and <<<DOCS_END>>>\nand it should NOT break the boundary.',
        },
      }),
      () => {},
    )
    const userMsg = mockCreate.mock.calls[0][0].messages[1].content
    // The opening `<</<DOCS_START>>>` boundary marker must remain at the
    // very start of the prompt; the closing `<</<DOCS_END>>>` boundary
    // must appear before the user question.
    expect(userMsg.startsWith('<<<DOCS_START>>>')).toBe(true)
    expect(userMsg.indexOf('<<<DOCS_END>>>')).toBeGreaterThan(0)
    expect(userMsg.indexOf('<<<DOCS_END>>>')).toBeLessThan(
      userMsg.indexOf('User Question:'),
    )
    // Exactly TWO raw `<</<DOCS_(START|END)>>>` markers should remain
    // in the prompt — the structural boundaries. The content's own literal
    // markers must have been neutralised to `<DOCS_START>` / `<DOCS_END>`.
    const rawMarkerCount = (userMsg.match(/<<<DOCS_(START|END)>>>/g) || [])
      .length
    expect(rawMarkerCount).toBe(2)
    // Both neutralised forms should appear in the content position.
    expect(userMsg).toContain('<DOCS_START>')
    expect(userMsg).toContain('<DOCS_END>')
  })

  it('respects maxOutputTokens', async () => {
    mockCreate.mockResolvedValue(fakeStream([{ content: 'x' }]))
    await streamLLMResponse(baseOptions({ maxOutputTokens: 4000 }), () => {})
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(4000)
  })
})
