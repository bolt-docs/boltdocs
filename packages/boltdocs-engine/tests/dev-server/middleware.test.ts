import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setupMiddlewares } from '../../src/node/dev-server/middleware'

type Handler = (
  req: { url?: string; headers: Record<string, string> },
  res: {
    statusCode: number
    setHeader: (name: string, value: string) => void
    end: (value?: string) => void
  },
  next: () => void,
) => unknown

function createFakeServer(root: string, transformIndexHtml: unknown) {
  const handlers: Handler[] = []
  const server = {
    config: { root },
    middlewares: {
      use(handler: Handler) {
        handlers.push(handler)
      },
    },
    transformIndexHtml,
  }
  return { server, handlers }
}

describe('dev-server HTML middleware', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-dev-mw-'))
    fs.writeFileSync(
      path.join(tempDir, 'index.html'),
      '<!doctype html><html class="dark" data-theme="dark"><head><meta charset="UTF-8"></head><body><div id="root"></div></body></html>',
    )
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('serves the project index.html and injects head meta exactly once', async () => {
    const calls: Array<{ url: string; originalUrl?: string }> = []
    const transformIndexHtml = vi.fn(
      async (url: string, html: string, originalUrl?: string) => {
        calls.push({ url, originalUrl })
        // Simulate the boltdocs `transformIndexHtml` hook (favicon injection).
        return html.replace(
          '</head>',
          '<link rel="icon" href="/light.svg">\n</head>',
        )
      },
    )

    const { server, handlers } = createFakeServer(tempDir, transformIndexHtml)
    const getConfig = () => ({ base: '/docs' })
    setupMiddlewares(server as never, tempDir, getConfig as never)

    const htmlHandler = handlers.at(-1) as Handler
    let body = ''
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: (value?: string) => {
        body = value ?? ''
      },
    }

    await htmlHandler(
      { url: '/docs', headers: { accept: 'text/html' } },
      res,
      () => {},
    )

    // The project template reached the browser (custom root attributes)…
    expect(body).toContain('class="dark"')
    // …the transform ran once, against the html entry (not the request URL)…
    expect(transformIndexHtml).toHaveBeenCalledTimes(1)
    expect(calls[0]).toEqual({ url: '/index.html', originalUrl: '/docs' })
    // …and the favicon was injected exactly once (no duplicates).
    expect(body.match(/rel="icon"/g)).toHaveLength(1)
  })

  it('falls back to the neutral shell when index.html is missing', async () => {
    fs.rmSync(path.join(tempDir, 'index.html'))
    const transformIndexHtml = vi.fn(async (_url: string, html: string) => html)
    const { server, handlers } = createFakeServer(tempDir, transformIndexHtml)
    const getConfig = () => ({ base: '/docs' })
    setupMiddlewares(server as never, tempDir, getConfig as never)

    const htmlHandler = handlers.at(-1) as Handler
    let body = ''
    await htmlHandler(
      { url: '/docs', headers: { accept: 'text/html' } },
      {
        statusCode: 0,
        setHeader: vi.fn(),
        end: (v?: string) => (body = v ?? ''),
      },
      () => {},
    )

    expect(body).toContain('<div id="root"></div>')
  })
})
