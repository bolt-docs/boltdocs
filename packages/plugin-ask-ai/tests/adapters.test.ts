import { describe, it, expect, vi } from 'vitest'
import { handleVercelAskAi } from '../src/server/adapters/vercel'
import { handleNetlifyAskAi } from '../src/server/adapters/netlify'
import { handleAwsAskAi } from '../src/server/adapters/aws'
import { handleWebAskAi } from '../src/server/adapters/web'
import { headers } from '../src/server/adapters/headers'
import type { AdapterConfig } from '../src/server/adapters/types'

// Mock streamLLMResponse
vi.mock('../src/server/handler', () => ({
  streamLLMResponse: vi.fn().mockImplementation(async (options, onChunk) => {
    onChunk('Hello ')
    onChunk('world')
  }),
}))

const baseConfig: AdapterConfig = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  systemPrompt: 'Test prompt',
}

describe('headers', () => {
  it('has correct SSE headers', () => {
    expect(headers['Content-Type']).toBe('text/event-stream')
    expect(headers['Cache-Control']).toBe('no-cache')
    expect(headers['Connection']).toBe('keep-alive')
    expect(headers['Access-Control-Allow-Origin']).toBe('*')
  })
})

describe('handleVercelAskAi', () => {
  function createMockReqRes(method: string, body?: any) {
    const req: any = {
      method,
      body,
    }
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      write: vi.fn(),
      end: vi.fn(),
      json: vi.fn(),
    }
    return { req, res }
  }

  it('returns 405 for non-POST methods', async () => {
    const { req, res } = createMockReqRes('GET')
    await handleVercelAskAi(req, res, baseConfig)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 400 for missing question', async () => {
    const { req, res } = createMockReqRes('POST', {})
    await handleVercelAskAi(req, res, baseConfig)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('streams SSE response for valid request', async () => {
    const { req, res } = createMockReqRes('POST', {
      question: 'test',
      context: [],
    })
    await handleVercelAskAi(req, res, baseConfig)

    expect(res.write).toHaveBeenCalledWith('data: {"text":"Hello "}\n\n')
    expect(res.write).toHaveBeenCalledWith('data: {"text":"world"}\n\n')
    expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n')
    expect(res.end).toHaveBeenCalled()
  })

  it('sets SSE headers', async () => {
    const { req, res } = createMockReqRes('POST', {
      question: 'test',
      context: [],
    })
    await handleVercelAskAi(req, res, baseConfig)

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream',
    )
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
  })
})

describe('handleNetlifyAskAi', () => {
  it('returns 405 for non-POST methods', async () => {
    const event = { httpMethod: 'GET' }
    const result = await handleNetlifyAskAi(event, baseConfig)
    expect(result.statusCode).toBe(405)
  })

  it('returns 400 for missing question', async () => {
    const event = { httpMethod: 'POST', body: '{}' }
    const result = await handleNetlifyAskAi(event, baseConfig)
    expect(result.statusCode).toBe(400)
  })

  it('returns SSE body for valid request', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ question: 'test', context: [] }),
    }
    const result = await handleNetlifyAskAi(event, baseConfig)
    expect(result.statusCode).toBe(200)
    expect(result.body).toContain('data: {"text":"Hello "}')
    expect(result.body).toContain('data: {"text":"world"}')
    expect(result.body).toContain('data: [DONE]')
  })

  it('handles OPTIONS for CORS', async () => {
    const event = { httpMethod: 'OPTIONS' }
    const result = await handleNetlifyAskAi(event, baseConfig)
    expect(result.statusCode).toBe(200)
  })
})

describe('handleAwsAskAi', () => {
  it('returns 405 for non-POST methods', async () => {
    const event = { httpMethod: 'GET' }
    const result = await handleAwsAskAi(event, baseConfig)
    expect(result.statusCode).toBe(405)
  })

  it('returns 400 for missing question', async () => {
    const event = { httpMethod: 'POST', body: '{}' }
    const result = await handleAwsAskAi(event, baseConfig)
    expect(result.statusCode).toBe(400)
  })

  it('returns SSE body for valid request', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ question: 'test' }),
    }
    const result = await handleAwsAskAi(event, baseConfig)
    expect(result.statusCode).toBe(200)
    expect(result.body).toContain('data: {"text":"Hello "}')
    expect(result.body).toContain('data: [DONE]')
  })
})

describe('handleWebAskAi', () => {
  it('returns 405 for non-POST methods', async () => {
    const request = new Request('http://localhost/api/ask-ai', {
      method: 'GET',
    })
    const result = await handleWebAskAi(request, baseConfig)
    expect(result.status).toBe(405)
  })

  it('returns 400 for missing question', async () => {
    const request = new Request('http://localhost/api/ask-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const result = await handleWebAskAi(request, baseConfig)
    expect(result.status).toBe(400)
  })

  it('returns streaming response for valid request', async () => {
    const request = new Request('http://localhost/api/ask-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'test', context: [] }),
    })
    const result = await handleWebAskAi(request, baseConfig)
    expect(result.status).toBe(200)
    expect(result.headers.get('Content-Type')).toBe('text/event-stream')

    const text = await result.text()
    expect(text).toContain('data: {"text":"Hello "}')
    expect(text).toContain('data: {"text":"world"}')
    expect(text).toContain('data: [DONE]')
  })

  it('handles OPTIONS for CORS', async () => {
    const request = new Request('http://localhost/api/ask-ai', {
      method: 'OPTIONS',
    })
    const result = await handleWebAskAi(request, baseConfig)
    expect(result.status).toBe(200)
  })
})
