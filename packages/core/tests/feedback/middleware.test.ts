import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupMiddlewares } from '../../src/node/dev-server/middleware'
import { handleFeedback } from '../../src/node/feedback/handler'
import type { ViteDevServer } from 'vite'

vi.mock('../../src/node/feedback/handler', () => ({
  handleFeedback: vi.fn(),
}))

describe('Feedback Dev-Server Middleware', () => {
  let mockServer: any
  let registeredMiddlewares: any[]
  let mockConfig: any

  beforeEach(() => {
    registeredMiddlewares = []
    mockServer = {
      middlewares: {
        use: vi.fn((mw) => {
          registeredMiddlewares.push(mw)
        }),
      },
      transformIndexHtml: vi.fn((url, html) => html),
    } as unknown as ViteDevServer

    mockConfig = {
      integrations: {
        feedback: {
          custom: {
            enabled: true,
            owner: 'testowner',
            repo: 'testrepo',
            categorySlug: 'general',
            endpoint: '/api/feedback',
          },
        },
      },
    }

    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // Find the custom feedback handler middleware from setupMiddlewares
  const getFeedbackMiddleware = () => {
    setupMiddlewares(mockServer, 'docs', () => mockConfig)
    return registeredMiddlewares.find((mw) =>
      mw.toString().includes('feedback'),
    )
  }

  it('should call next() if custom feedback integration is disabled', () => {
    mockConfig.integrations.feedback.custom.enabled = false
    const middleware = getFeedbackMiddleware()

    const req = { method: 'POST', url: '/api/feedback' }
    const res = { setHeader: vi.fn(), end: vi.fn() }
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(handleFeedback).not.toHaveBeenCalled()
  })

  it('should call next() if the request path does not match the configured endpoint', () => {
    const middleware = getFeedbackMiddleware()

    const req = { method: 'POST', url: '/api/some-other-endpoint' }
    const res = { setHeader: vi.fn(), end: vi.fn() }
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(handleFeedback).not.toHaveBeenCalled()
  })

  it('should call next() if the request method is not POST', () => {
    const middleware = getFeedbackMiddleware()

    const req = { method: 'GET', url: '/api/feedback' }
    const res = { setHeader: vi.fn(), end: vi.fn() }
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(handleFeedback).not.toHaveBeenCalled()
  })

  it('should process, parse, and successfully return JSON on matching POST request', async () => {
    vi.mocked(handleFeedback).mockResolvedValue({ success: true })

    const middleware = getFeedbackMiddleware()

    const mockPayload = {
      rating: 'good',
      comment: 'Excellent documentation!',
      path: '/docs/intro',
      title: 'Intro Page',
    }

    // Mock an event emitter for the request stream
    const listeners: Record<string, Function> = {}
    const req = {
      method: 'POST',
      url: '/api/feedback',
      on: vi.fn((event, cb) => {
        listeners[event] = cb
      }),
    }

    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader: vi.fn(function (name, val) {
        this.headers[name] = val
      }),
      end: vi.fn(),
    }

    const next = vi.fn()

    // Trigger the middleware
    middleware(req, res, next)

    // Simulate request stream data and end events
    listeners['data'](JSON.stringify(mockPayload))
    await listeners['end']()

    expect(handleFeedback).toHaveBeenCalledWith(mockPayload, process.env, {
      owner: 'testowner',
      repo: 'testrepo',
      categorySlug: 'general',
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toBe('application/json')
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ success: true }))
    expect(next).not.toHaveBeenCalled()
  })

  it('should handle JSON parse errors and return 500 error status', async () => {
    const middleware = getFeedbackMiddleware()

    const listeners: Record<string, Function> = {}
    const req = {
      method: 'POST',
      url: '/api/feedback',
      on: vi.fn((event, cb) => {
        listeners[event] = cb
      }),
    }

    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader: vi.fn(function (name, val) {
        this.headers[name] = val
      }),
      end: vi.fn(),
    }

    const next = vi.fn()

    middleware(req, res, next)

    // Emit invalid JSON string to trigger parsing error
    listeners['data']('{ invalid json... }')
    await listeners['end']()

    expect(res.statusCode).toBe(500)
    expect(res.headers['Content-Type']).toBe('application/json')
    const endResponse = JSON.parse(res.end.mock.calls[0][0])
    expect(endResponse.error).toBeDefined()
    expect(next).not.toHaveBeenCalled()
  })

  it('should handle submission handler rejections and return 500 status', async () => {
    vi.mocked(handleFeedback).mockRejectedValue(
      new Error('Failed to connect to GitHub API'),
    )

    const middleware = getFeedbackMiddleware()

    const mockPayload = {
      rating: 'bad',
      comment: 'Broken link.',
      path: '/docs/help',
      title: 'Help',
    }

    const listeners: Record<string, Function> = {}
    const req = {
      method: 'POST',
      url: '/api/feedback',
      on: vi.fn((event, cb) => {
        listeners[event] = cb
      }),
    }

    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader: vi.fn(function (name, val) {
        this.headers[name] = val
      }),
      end: vi.fn(),
    }

    const next = vi.fn()

    middleware(req, res, next)

    listeners['data'](JSON.stringify(mockPayload))
    await listeners['end']()

    expect(res.statusCode).toBe(500)
    expect(res.headers['Content-Type']).toBe('application/json')
    expect(res.end).toHaveBeenCalledWith(
      JSON.stringify({ error: 'Failed to connect to GitHub API' }),
    )
    expect(next).not.toHaveBeenCalled()
  })
})
