import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleVercelAskAi } from '../src/server/adapters/vercel'
import { handleNetlifyAskAi } from '../src/server/adapters/netlify'
import { handleAwsAskAi } from '../src/server/adapters/aws'
import { handleWebAskAi } from '../src/server/adapters/web'
import { headers } from '../src/server/adapters/headers'
import { streamLLMResponse } from '../src/server/handler'
import type { AdapterConfig } from '../src/server/adapters/types'

vi.mock('../src/server/handler', () => ({
  streamLLMResponse: vi
    .fn()
    .mockImplementation(async (_options: any, onEvent: (e: any) => void) => {
      onEvent({
        type: 'context',
        data: { page: '/docs/foo', chars: 100, elapsedMs: 4 },
      })
      onEvent({ type: 'text', data: 'Hello ' })
      onEvent({ type: 'text', data: 'world' })
      onEvent({ type: 'done' })
    }),
}))

const baseConfig: AdapterConfig = {
  model: 'gpt-4o-mini',
  systemPrompt: 'Test prompt',
}

beforeEach(() => {
  vi.mocked(streamLLMResponse).mockClear()
})

describe('headers', () => {
  it('exposes SSE headers', () => {
    expect(headers['Content-Type']).toBe('text/event-stream')
    expect(headers['Cache-Control']).toBe('no-cache')
    expect(headers['Connection']).toBe('keep-alive')
  })
})

describe('handleVercelAskAi', () => {
  function mockReqRes(method: string, body?: any) {
    const req: any = { method, body }
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      write: vi.fn(),
      end: vi.fn(),
      json: vi.fn(),
    }
    return { req, res }
  }

  it('returns 405 for non-POST', async () => {
    const { req, res } = mockReqRes('GET')
    await handleVercelAskAi(req, res, baseConfig)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 400 when question is missing', async () => {
    const { req, res } = mockReqRes('POST', {})
    await handleVercelAskAi(req, res, baseConfig)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('emits context -> text -> text -> DONE in SSE format', async () => {
    const { req, res } = mockReqRes('POST', { question: 'test' })
    await handleVercelAskAi(req, res, baseConfig)

    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"context":{"page":"/docs/foo"'),
    )
    expect(res.write).toHaveBeenCalledWith('data: {"text":"Hello "}\n\n')
    expect(res.write).toHaveBeenCalledWith('data: {"text":"world"}\n\n')
    expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n')
    expect(res.end).toHaveBeenCalled()
  })

  it('forwards client-supplied context to streamLLMResponse', async () => {
    const { req, res } = mockReqRes('POST', {
      question: 'q',
      context: { page: '/docs/x', content: 'page content here' },
    })
    await handleVercelAskAi(req, res, baseConfig)
    const opts = vi.mocked(streamLLMResponse).mock.calls[0][0]
    expect(opts.context).toEqual({
      page: '/docs/x',
      content: 'page content here',
    })
  })
})

describe('handleNetlifyAskAi', () => {
  it('returns 405 for non-POST', async () => {
    const r = await handleNetlifyAskAi({ httpMethod: 'GET' }, baseConfig)
    expect(r.statusCode).toBe(405)
  })

  it('returns 400 when question is missing', async () => {
    const r = await handleNetlifyAskAi(
      { httpMethod: 'POST', body: '{}' },
      baseConfig,
    )
    expect(r.statusCode).toBe(400)
  })

  it('emits full SSE payload in body', async () => {
    const r = await handleNetlifyAskAi(
      { httpMethod: 'POST', body: JSON.stringify({ question: 'q' }) },
      baseConfig,
    )
    expect(r.statusCode).toBe(200)
    expect(r.body).toContain('"context":{"page":"/docs/foo"')
    expect(r.body).toContain('"text":"Hello "')
    expect(r.body).toContain('"text":"world"')
    expect(r.body).toContain('data: [DONE]')
  })

  it('handles OPTIONS', async () => {
    const r = await handleNetlifyAskAi({ httpMethod: 'OPTIONS' }, baseConfig)
    expect(r.statusCode).toBe(200)
  })
})

describe('handleAwsAskAi', () => {
  it('returns 405 for non-POST', async () => {
    const r = await handleAwsAskAi({ httpMethod: 'GET' }, baseConfig)
    expect(r.statusCode).toBe(405)
  })

  it('returns 400 when question is missing', async () => {
    const r = await handleAwsAskAi(
      { httpMethod: 'POST', body: '{}' },
      baseConfig,
    )
    expect(r.statusCode).toBe(400)
  })

  it('emits full SSE payload in body', async () => {
    const r = await handleAwsAskAi(
      { httpMethod: 'POST', body: JSON.stringify({ question: 'q' }) },
      baseConfig,
    )
    expect(r.statusCode).toBe(200)
    expect(r.body).toContain('"context":{"page":"/docs/foo"')
    expect(r.body).toContain('data: [DONE]')
  })
})

describe('handleWebAskAi', () => {
  it('returns 405 for non-POST', async () => {
    const req = new Request('http://x/api/ask-ai', { method: 'GET' })
    const r = await handleWebAskAi(req, baseConfig)
    expect(r.status).toBe(405)
  })

  it('returns 400 when question is missing', async () => {
    const req = new Request('http://x/api/ask-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const r = await handleWebAskAi(req, baseConfig)
    expect(r.status).toBe(400)
  })

  it('returns a streaming Response with full SSE sequence', async () => {
    const req = new Request('http://x/api/ask-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'q' }),
    })
    const r = await handleWebAskAi(req, baseConfig)
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('text/event-stream')
    const text = await r.text()
    expect(text).toContain('"context":{"page":"/docs/foo"')
    expect(text).toContain('"text":"Hello "')
    expect(text).toContain('"text":"world"')
    expect(text).toContain('data: [DONE]')
  })

  it('handles OPTIONS', async () => {
    const req = new Request('http://x/api/ask-ai', { method: 'OPTIONS' })
    const r = await handleWebAskAi(req, baseConfig)
    expect(r.status).toBe(200)
  })
})
