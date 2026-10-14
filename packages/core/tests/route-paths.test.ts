import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildTypeRoutePaths,
  normalizeBasePath,
  withBasePath,
} from '../src/node/route-paths'
import type { BoltdocsConfig } from '../../src/shared/types'

describe('normalizeBasePath', () => {
  it('strips trailing and leading slashes', () => {
    expect(normalizeBasePath('/docs/')).toBe('/docs')
    expect(normalizeBasePath('docs')).toBe('/docs')
    expect(normalizeBasePath('/docs')).toBe('/docs')
  })

  it('falls back to root for empty values', () => {
    expect(normalizeBasePath('/')).toBe('/')
    expect(normalizeBasePath('')).toBe('/')
    expect(normalizeBasePath(undefined)).toBe('/')
  })
})

describe('withBasePath', () => {
  it('is idempotent for paths that already carry the base', () => {
    expect(withBasePath('/docs/guides', '/docs')).toBe('/docs/guides')
    expect(withBasePath('/docs', '/docs')).toBe('/docs')
  })

  it('adds the base when it is missing', () => {
    // Collection routes keep their metadata unprefixed even though the SSG
    // emits them under the base, so the link tree has to add it back.
    expect(withBasePath('/blog/post', '/docs')).toBe('/docs/blog/post')
    expect(withBasePath('/es/blog/post', '/docs')).toBe('/docs/es/blog/post')
  })

  it('maps the root path onto the base', () => {
    expect(withBasePath('/', '/docs')).toBe('/docs')
  })

  it('never doubles the base', () => {
    expect(withBasePath('/docs/docs/guides', '/docs')).toBe('/docs/docs/guides')
  })

  it('is a no-op when the base is root', () => {
    expect(withBasePath('/roadmap', '/')).toBe('/roadmap')
  })
})

describe('buildTypeRoutePaths', () => {
  it('includes the base and the external pages alongside doc routes', () => {
    const paths = buildTypeRoutePaths(
      [{ path: '/docs/guides' }, { path: '/docs/api' }],
      '/docs',
      ['/', '/about', '/roadmap', '/showcase'],
    )

    expect(paths).toContain('/docs/guides')
    expect(paths).toContain('/docs/api')
    expect(paths).toContain('/docs')
    // External pages live at the site root by design and stay unprefixed.
    expect(paths).toContain('/roadmap')
    expect(paths).toContain('/showcase')
    expect(paths).not.toContain('/docs/roadmap')
  })

  it('base-prefixes collection routes that lack it', () => {
    const paths = buildTypeRoutePaths(
      [{ path: '/blog/boltdocs-3.4.0' }],
      '/docs',
    )

    expect(paths).toContain('/docs/blog/boltdocs-3.4.0')
    expect(paths).not.toContain('/blog/boltdocs-3.4.0')
  })

  it('de-duplicates while preserving order', () => {
    const paths = buildTypeRoutePaths(
      [{ path: '/docs/a' }, { path: '/docs/a' }, { path: '/docs' }],
      '/docs',
      ['/roadmap', '/roadmap'],
    )

    expect(paths).toEqual(['/docs/a', '/docs', '/roadmap'])
  })
})

describe('external page rewrite', () => {
  let root: string
  let docsDir: string
  const stack: Array<{ route: string; handle: Middleware }> = []

  type Middleware = (
    req: { url?: string; method?: string },
    res: unknown,
    next: () => void,
  ) => void

  beforeEach(() => {
    vi.resetModules()
    stack.length = 0
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-ext-'))
    docsDir = path.join(root, 'docs')
    fs.mkdirSync(path.join(docsDir, 'pages-external'), { recursive: true })
    fs.writeFileSync(
      path.join(docsDir, 'pages-external', 'index.tsx'),
      "export const pages = {\n  '/about': () => import('./about'),\n  '/roadmap': () => import('./roadmap'),\n}\n",
    )
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  async function install(base = '/docs'): Promise<Middleware> {
    const { installExternalPageRewrite } = await import(
      '../src/node/dev-server/external-page-rewrite'
    )
    installExternalPageRewrite(
      { middlewares: { stack } } as never,
      docsDir,
      () => ({ base }) as BoltdocsConfig,
    )
    return stack[0].handle
  }

  const request = (url: string) => ({ url, method: 'GET' })

  it('installs ahead of Vite internal middlewares', async () => {
    // The first dynamic import in this file pulls in the route generator, which
    // is cold here and can exceed the default budget under full-suite load.
    await install()
    expect(stack).toHaveLength(1)
    expect(stack[0].route).toBe('')
  }, 30_000)

  it('rewrites a site-root external path to its base-prefixed form', async () => {
    const handle = await install()
    const req = request('/roadmap')

    handle(req, {}, () => {})

    // The SSG middleware strips the base back off, so this resolves to the
    // same external route the visitor asked for.
    expect(req.url).toBe('/docs/roadmap')
  })

  it('preserves the query string while rewriting', async () => {
    const handle = await install()
    const req = request('/roadmap?tab=shipped')

    handle(req, {}, () => {})

    expect(req.url).toBe('/docs/roadmap?tab=shipped')
  })

  it('leaves requests inside the base untouched', async () => {
    const handle = await install()
    const req = request('/docs/guides/getting-started')

    handle(req, {}, () => {})

    expect(req.url).toBe('/docs/guides/getting-started')
  })

  it('leaves unknown paths untouched', async () => {
    const handle = await install()
    const req = request('/not-a-page')

    handle(req, {}, () => {})

    expect(req.url).toBe('/not-a-page')
  })

  it('always delegates so no request is left hanging', async () => {
    const handle = await install()
    let nextCalls = 0

    handle(request('/roadmap'), {}, () => {
      nextCalls++
    })
    handle(request('/docs/guides'), {}, () => {
      nextCalls++
    })
    handle(request('/missing'), {}, () => {
      nextCalls++
    })

    expect(nextCalls).toBe(3)
  })

  it('is a no-op when the base is the site root', async () => {
    const handle = await install('/')
    const req = request('/roadmap')

    handle(req, {}, () => {})

    expect(req.url).toBe('/roadmap')
  })
})
