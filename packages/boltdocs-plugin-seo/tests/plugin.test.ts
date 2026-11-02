import { describe, it, expect } from 'vitest'
import { seo, writeSeoArtifacts } from '../src/node/index'
import type { RouteMeta } from '@bdocs/contracts'

function withRoutes(): RouteMeta[] {
  return [
    { path: '/docs/a' },
    { path: '/docs/b', seo: { noindex: true } },
  ] as RouteMeta[]
}

describe('plugin-seo', () => {
  it('registers under the name the core notice looks for', () => {
    expect(seo().name).toBe('plugin-seo')
  })

  it('declares both hooks SEO needs at different points in the build', () => {
    const hooks = seo().hooks ?? {}

    expect(typeof hooks['build:routes']).toBe('function')
    expect(typeof hooks['build:generate']).toBe('function')
  })

  it('build:routes enriches the live route array', () => {
    const hooks = seo().hooks ?? {}
    const routes = withRoutes()
    const warnings: string[] = []

    hooks['build:routes']?.(
      {
        config: { siteUrl: 'https://example.com' },
        logger: { warn: (m: string) => warnings.push(m) },
      } as never,
      { routes },
    )

    expect((routes[0].seo as Record<string, unknown>).canonical).toBe(
      'https://example.com/docs/a',
    )
  })

  it('build:generate writes both artifacts', async () => {
    const hooks = seo().hooks ?? {}
    const { mkdtempSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { readFileSync } = await import('node:fs')
    const outDir = mkdtempSync(join(tmpdir(), 'seo-'))

    await hooks['build:generate']?.(
      {
        config: { siteUrl: 'https://example.com' },
        logger: { warn: () => {} },
      } as never,
      { routes: withRoutes(), outDir },
    )

    const sitemap = readFileSync(join(outDir, 'sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://example.com/docs/a</loc>')
    expect(sitemap).not.toContain('/docs/b</loc>')

    const robots = readFileSync(join(outDir, 'robots.txt'), 'utf-8')
    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('Sitemap: https://example.com/sitemap.xml')
  })

  it('warns instead of writing a useless relative sitemap', () => {
    const warnings: string[] = []
    const result = writeSeoArtifacts(
      withRoutes(),
      {},
      `${process.env.TMPDIR ?? '/tmp'}/seo-notice-${process.pid}`,
      (m) => warnings.push(m),
    )

    expect(result.sitemap).toBe(false)
    expect(result.robots).toBe(true)
    expect(warnings.some((w) => w.includes('siteUrl'))).toBe(true)
  })
})
