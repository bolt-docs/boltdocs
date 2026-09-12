import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAskAiMiddleware } from '../src/node/middleware'
import { DEFAULT_DENY_PATTERNS } from '../src/node/safety'
import type { MiddlewareConfig } from '../src/node/middleware'

const streamLLMResponse = vi.hoisted(() =>
  vi.fn(async (options: any, onEvent: (event: any) => void) => {
    if (!options.env[options.providerEnvKey]) {
      onEvent({
        type: 'error',
        data: `${options.providerEnvKey} is not set`,
      })
      return
    }
    onEvent({
      type: 'context',
      data: { page: '/docs/start', chars: 10, elapsedMs: 1 },
    })
    onEvent({ type: 'text', data: 'fake answer' })
    onEvent({ type: 'done' })
  }),
)

vi.mock('../src/server/index', () => ({ streamLLMResponse }))
vi.mock('boltdocs', () => ({
  generateRoutes: vi.fn(async () => [
    { path: '/docs/start', title: 'Start', _content: 'Documentation' },
  ]),
}))

beforeEach(() => {
  streamLLMResponse.mockClear()
  vi.stubEnv('OPENAI_API_KEY', 'fake-key')
})

class MockRequest extends EventEmitter {
  method = 'POST'
  url = '/api/ask-ai'
  headers: Record<string, string> = {}
  socket = { remoteAddress: 'middleware-test' }
}

function makeResponse() {
  const chunks: string[] = []
  let resolveEnd: () => void = () => {}
  const ended = new Promise<void>((resolve) => {
    resolveEnd = resolve
  })
  return {
    chunks,
    ended,
    setHeader: vi.fn(),
    write: vi.fn((chunk: string) => chunks.push(chunk)),
    end: vi.fn(() => resolveEnd()),
  }
}

function baseConfig(
  overrides: Partial<MiddlewareConfig> = {},
): MiddlewareConfig {
  return {
    provider: 'openai',
    model: 'gpt-4o-mini',
    endpoint: '/api/ask-ai',
    systemPrompt: 'test',
    maxInputChars: 2000,
    maxOutputTokens: 100,
    contextChars: 1000,
    denyPatterns: DEFAULT_DENY_PATTERNS,
    providerEnvKey: 'OPENAI_API_KEY',
    rateLimitPerMinute: 30,
    devMode: false,
    ...overrides,
  }
}

async function request(
  config: MiddlewareConfig,
  body: unknown,
  setup?: (req: MockRequest) => void,
) {
  const req = new MockRequest()
  setup?.(req)
  const response = makeResponse()
  const next = vi.fn()
  createAskAiMiddleware(config, '/tmp/boltdocs-test')(
    req as any,
    response as any,
    next,
  )
  req.emit('data', Buffer.from(JSON.stringify(body)))
  req.emit('end')
  await response.ended
  return { req, response, next }
}

describe('createAskAiMiddleware', () => {
  it('streams a fake provider response for POST /api/ask-ai', async () => {
    const result = await request(baseConfig(), {
      question: 'What is this?',
      currentPage: '/docs/start',
    })

    expect(result.next).not.toHaveBeenCalled()
    expect(result.response.chunks.join('')).toContain('fake answer')
    expect(result.response.chunks.join('')).toContain('data: [DONE]')
    expect(streamLLMResponse).toHaveBeenCalled()
  })

  it('returns an SSE error when the provider key is missing', async () => {
    vi.unstubAllEnvs()
    const result = await request(
      baseConfig({ providerEnvKey: 'MISSING_TEST_KEY' }),
      { question: 'What is this?', currentPage: '/docs/start' },
    )

    const call = streamLLMResponse.mock.calls.at(-1)?.[0]
    expect(call.env.MISSING_TEST_KEY).toBeUndefined()
    expect(result.response.chunks.join('')).toContain('MISSING_TEST_KEY')
  })

  it('rejects an invalid secret before calling the provider', async () => {
    const result = await request(baseConfig({ secretKey: 'server-secret' }), {
      question: 'What is this?',
    })

    expect(result.response.chunks.join('')).toContain('UNAUTHORIZED')
    expect(streamLLMResponse).not.toHaveBeenCalledWith(
      expect.objectContaining({ question: 'What is this?' }),
      expect.any(Function),
    )
  })

  it('rate limits repeated requests from the same client', async () => {
    const config = baseConfig({ rateLimitPerMinute: 1 })
    await request(config, { question: 'first' })
    const result = await request(config, { question: 'second' })

    expect(result.response.chunks.join('')).toContain('RATE_LIMITED')
  })

  it('propagates a client disconnect to the upstream abort signal', async () => {
    let resolveProviderStarted: () => void = () => {}
    const providerStarted = new Promise<void>((resolve) => {
      resolveProviderStarted = resolve
    })
    streamLLMResponse.mockImplementationOnce(async (options: any) => {
      resolveProviderStarted()
      await new Promise<void>((resolve) => {
        if (options.signal.aborted) resolve()
        else
          options.signal.addEventListener('abort', () => resolve(), {
            once: true,
          })
      })
    })
    const req = new MockRequest()
    const response = makeResponse()
    createAskAiMiddleware(baseConfig(), '/tmp/boltdocs-test')(
      req as any,
      response as any,
      vi.fn(),
    )
    req.emit('data', Buffer.from(JSON.stringify({ question: 'abort me' })))
    req.emit('end')
    await providerStarted
    req.emit('close')
    await response.ended
    expect(streamLLMResponse).toHaveBeenCalled()
  })
})
