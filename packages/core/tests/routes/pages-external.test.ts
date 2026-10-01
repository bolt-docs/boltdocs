import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getExternalFileRoutes } from '../../src/node/routes/pages-external'
import type { BoltdocsConfig } from '../../src/shared/types'

const created: string[] = []

function createDocsDir(files: string[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-file-routing-'))
  created.push(root)
  const docsDir = path.join(root, 'docs')
  for (const file of files) {
    const target = path.join(docsDir, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, '# content')
  }
  return docsDir
}

const config: BoltdocsConfig = { experimental: { fileRouting: true } }

afterEach(() => {
  for (const root of created.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('getExternalFileRoutes', () => {
  it('returns nothing when file routing is disabled', () => {
    const docsDir = createDocsDir(['pages-external/about.mdx'])
    expect(getExternalFileRoutes(docsDir, {})).toEqual([])
  })

  it('maps static files to literal routes', () => {
    const docsDir = createDocsDir([
      'pages-external/about.mdx',
      'pages-external/guides/start.mdx',
    ])

    const routes = getExternalFileRoutes(docsDir, config)
    expect(routes.map((route) => route.path)).toEqual([
      '/about',
      '/guides/start',
    ])
  })

  it('maps index files to their directory route', () => {
    const docsDir = createDocsDir(['pages-external/guides/index.mdx'])

    expect(getExternalFileRoutes(docsDir, config)[0].path).toBe('/guides')
  })

  it('maps a single dynamic segment to a router param', () => {
    const docsDir = createDocsDir(['pages-external/blog/[slug].mdx'])

    expect(getExternalFileRoutes(docsDir, config)[0].path).toBe('/blog/:slug')
  })

  it('maps a catch-all segment to a wildcard', () => {
    const docsDir = createDocsDir(['pages-external/docs/[...parts].mdx'])

    expect(getExternalFileRoutes(docsDir, config)[0].path).toBe('/docs/*')
  })

  it('maps an optional catch-all segment', () => {
    const docsDir = createDocsDir(['pages-external/shop/[[...parts]].mdx'])

    expect(getExternalFileRoutes(docsDir, config)[0].path).toBe('/shop/*?')
  })

  it('supports dynamic directories and static siblings together', () => {
    const docsDir = createDocsDir([
      'pages-external/blog/[slug].mdx',
      'pages-external/blog/index.mdx',
    ])

    expect(getExternalFileRoutes(docsDir, config).map((r) => r.path)).toEqual([
      '/blog',
      '/blog/:slug',
    ])
  })

  it('keeps the locale prefix before the dynamic segment', () => {
    const docsDir = createDocsDir(['pages-external/es/blog/[slug].mdx'])

    const [route] = getExternalFileRoutes(docsDir, {
      ...config,
      i18n: { defaultLocale: 'en', locales: ['en', 'es'] },
    })
    expect(route.locale).toBe('es')
    expect(route.path).toBe('/es/blog/:slug')
  })

  it('ignores framework files inside pages-external', () => {
    const docsDir = createDocsDir([
      'pages-external/layout.tsx',
      'pages-external/icons.tsx',
      'pages-external/real.mdx',
    ])

    expect(getExternalFileRoutes(docsDir, config).map((r) => r.path)).toEqual([
      '/real',
    ])
  })
})
