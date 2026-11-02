import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createFeedbackMiddleware,
  createStaticHtmlMiddleware,
} from '../../src/node/plugin/middlewares'

describe('createStaticHtmlMiddleware', () => {
  let root: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-static-'))
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  const makeMiddleware = (outDir = 'dist') =>
    createStaticHtmlMiddleware(
      () =>
        ({
          root,
          build: { outDir },
        }) as any,
    )

  const run = (
    mw: ReturnType<typeof createStaticHtmlMiddleware>,
    url: string,
  ) => {
    const req = { url, headers: {} }
    const res = {}
    const next = vi.fn()
    mw(req as any, res as any, next)
    return { req: req as any, next }
  }

  it('rewrites a pathless request to index.html when a candidate exists', () => {
    const dist = path.join(root, 'dist')
    fs.mkdirSync(path.join(dist, 'docs', 'guide'), { recursive: true })
    fs.writeFileSync(path.join(dist, 'docs', 'guide', 'index.html'), '<h1>')
    const mw = makeMiddleware()
    const { req, next } = run(mw, '/docs/guide')
    expect(req.url).toBe('/docs/guide/index.html')
    expect(next).toHaveBeenCalled()
  })

  it('leaves the url untouched when no index.html exists', () => {
    const mw = makeMiddleware()
    const { req, next } = run(mw, '/docs/missing')
    expect(req.url).toBe('/docs/missing')
    expect(next).toHaveBeenCalled()
  })

  it('passes through requests that have a file extension', () => {
    const mw = makeMiddleware()
    const { req, next } = run(mw, '/assets/app.js')
    expect(req.url).toBe('/assets/app.js')
    expect(next).toHaveBeenCalled()
  })

  it('does not rewrite the root path', () => {
    const mw = makeMiddleware()
    const { req, next } = run(mw, '/')
    expect(req.url).toBe('/')
    expect(next).toHaveBeenCalled()
  })
})

describe('createFeedbackMiddleware', () => {
  it('delegates to next when feedback is disabled', () => {
    const mw = createFeedbackMiddleware(
      () =>
        ({
          integrations: { feedback: { custom: { enabled: false } } },
        }) as any,
    )
    const next = vi.fn()
    mw(
      { method: 'POST', url: '/api/feedback', headers: {} } as any,
      {} as any,
      next,
    )
    expect(next).toHaveBeenCalled()
  })

  it('delegates to next when the path does not match the endpoint', () => {
    const mw = createFeedbackMiddleware(() => ({}) as any)
    const next = vi.fn()
    mw({ method: 'POST', url: '/other', headers: {} } as any, {} as any, next)
    expect(next).toHaveBeenCalled()
  })
})
